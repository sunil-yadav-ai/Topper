import { PDFDocument } from "pdf-lib";
import { env } from "../config/env.js";
import { decryptJson, encryptJson } from "./encrypted-json.service.js";
import { getPrivateNoteDownloadUrl } from "./note-storage.service.js";

const maxPdfPages = 100;
const pageSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageNumber: { type: "integer", minimum: 1 },
    extractedText: { type: "string" },
    recognizedFormulas: { type: "array", items: { type: "string" } },
    readabilityStatus: {
      type: "string",
      enum: ["readable", "partially_readable", "unreadable"],
    },
    ocrConfidence: { type: "number", minimum: 0, maximum: 1 },
    unclearRegions: { type: "array", items: { type: "string" } },
  },
  required: [
    "pageNumber",
    "extractedText",
    "recognizedFormulas",
    "readabilityStatus",
    "ocrConfidence",
    "unclearRegions",
  ],
};

export const decryptOcrResult = decryptJson;

async function getSourceFile(note) {
  if (note.storage.provider !== "cloudinary") {
    throw new Error("The note uses an unsupported storage provider.");
  }
  const response = await fetch(getPrivateNoteDownloadUrl(note.storage), {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    throw new Error(`Could not download the stored note (HTTP ${response.status}).`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length === 0 || data.length > 10 * 1024 * 1024) {
    throw new Error("Stored note is empty or exceeds the 10 MB processing limit.");
  }
  return data;
}

export async function splitPdfIntoPages(pdfBytes) {
  const source = await PDFDocument.load(pdfBytes);
  const pageCount = source.getPageCount();
  if (pageCount === 0 || pageCount > maxPdfPages) {
    throw new Error(`PDFs must contain between 1 and ${maxPdfPages} pages.`);
  }

  const pages = [];
  for (let index = 0; index < pageCount; index += 1) {
    const singlePage = await PDFDocument.create();
    const [page] = await singlePage.copyPages(source, [index]);
    singlePage.addPage(page);
    pages.push({
      pageNumber: index + 1,
      mimeType: "application/pdf",
      bytes: Buffer.from(await singlePage.save()),
    });
  }
  return pages;
}

async function callVisionModel(page) {
  if (!env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const instruction =
    "Read this handwritten academic-notes page. Transcribe only text you can actually read; " +
    "do not guess, correct, or complete unclear words, formulas, or statements. " +
    "Mark unclear handwriting in unclearRegions, use [unclear] in extractedText where needed, " +
    "and set readabilityStatus to unreadable if the handwriting cannot be reliably read. " +
    "Uncertainty is not evidence that the author is wrong. Identify mathematical formulas " +
    "separately in recognizedFormulas, preserving their notation as closely as possible. " +
    `This is source page ${page.pageNumber}; return that exact pageNumber. ` +
    "Set ocrConfidence between 0 (no confidence) and 1 (high confidence) for the page transcription.";
  const content = [{ type: "input_text", text: instruction }];

  if (page.mimeType === "application/pdf") {
    content.push({
      type: "input_file",
      filename: `page-${page.pageNumber}.pdf`,
      file_data: `data:application/pdf;base64,${page.bytes.toString("base64")}`,
    });
  } else {
    content.push({
      type: "input_image",
      image_url: `data:${page.mimeType};base64,${page.bytes.toString("base64")}`,
      detail: "high",
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(90000),
    body: JSON.stringify({
      model: env.openAiOcrModel,
      input: [{ role: "user", content }],
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "handwritten_note_page",
          strict: true,
          schema: pageSchema,
        },
      },
      max_output_tokens: 3000,
    }),
  });
  if (!response.ok) {
    const error = new Error(`Vision API returned HTTP ${response.status}.`);
    if (response.status === 429) {
      let providerErrorCode;
      try {
        const payload = await response.json();
        providerErrorCode = payload.error?.code ?? payload.error?.type;
      } catch (parseError) {
        if (!(parseError instanceof SyntaxError)) throw parseError;
      }
      error.providerErrorCode = providerErrorCode;
      if (typeof providerErrorCode === "string") {
        error.message = `Vision API returned HTTP 429 (${providerErrorCode}).`;
      }
      error.retryableRateLimit = ![
        "insufficient_quota",
        "billing_hard_limit_reached",
      ].includes(providerErrorCode);
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter !== null) {
        const retryAfterSeconds = Number(retryAfter);
        const retryAfterDate = Date.parse(retryAfter);
        if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
          error.retryAfterMs = retryAfterSeconds * 1000;
        } else if (Number.isFinite(retryAfterDate)) {
          error.retryAfterMs = Math.max(0, retryAfterDate - Date.now());
        }
      }
    }
    throw error;
  }

  const payload = await response.json();
  const outputText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;
  if (!outputText) {
    throw new Error("Vision API returned no structured OCR result.");
  }

  const result = JSON.parse(outputText);
  if (
    result.pageNumber !== page.pageNumber ||
    typeof result.extractedText !== "string" ||
    !Array.isArray(result.recognizedFormulas) ||
    !["readable", "partially_readable", "unreadable"].includes(result.readabilityStatus) ||
    !Number.isFinite(result.ocrConfidence) ||
    result.ocrConfidence < 0 ||
    result.ocrConfidence > 1 ||
    !Array.isArray(result.unclearRegions)
  ) {
    throw new Error(`Vision API returned invalid structured OCR for page ${page.pageNumber}.`);
  }
  return result;
}

export async function extractNoteText(note, beforePage) {
  const source = await getSourceFile(note);
  const pages =
    note.storage.format === "pdf"
      ? await splitPdfIntoPages(source)
      : [
          {
            pageNumber: 1,
            mimeType: note.storage.mimeType,
            bytes: source,
          },
        ];

  const result = [];
  for (const page of pages) {
    if (beforePage) await beforePage();
    result.push(await callVisionModel(page));
  }

  return { pages: result };
}

export function encryptOcrResult(result) {
  return encryptJson(result);
}

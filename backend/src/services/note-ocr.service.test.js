import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { PDFDocument } from "pdf-lib";

process.env.OCR_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.OPENAI_API_KEY = "test-api-key";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-key";
process.env.CLOUDINARY_API_SECRET = "test-secret";
const {
  decryptOcrResult,
  encryptOcrResult,
  extractNoteText,
  splitPdfIntoPages,
} = await import("./note-ocr.service.js");

test("splits PDFs into individually numbered pages", async () => {
  const source = await PDFDocument.create();
  source.addPage([612, 792]);
  source.addPage([792, 612]);

  const pages = await splitPdfIntoPages(Buffer.from(await source.save()));

  assert.deepEqual(pages.map((page) => page.pageNumber), [1, 2]);
  assert.equal(pages[0].mimeType, "application/pdf");
  assert.equal((await PDFDocument.load(pages[0].bytes)).getPageCount(), 1);
  assert.equal((await PDFDocument.load(pages[1].bytes)).getPageCount(), 1);
});

test("encrypts OCR output and rejects ciphertext tampering", () => {
  const result = {
    pages: [
      {
        pageNumber: 1,
        extractedText: "x + [unclear]",
        recognizedFormulas: ["x + 1 = 2"],
        readabilityStatus: "partially_readable",
        ocrConfidence: 0.72,
        unclearRegions: ["line 2"],
      },
    ],
  };
  const encrypted = encryptOcrResult(result);

  assert.notEqual(encrypted.ciphertext, JSON.stringify(result));
  assert.deepEqual(decryptOcrResult(encrypted), result);
  assert.throws(() =>
    decryptOcrResult({
      ...encrypted,
      ciphertext: Buffer.from("tampered").toString("base64"),
    }),
  );
});

test("sends each PDF page separately and preserves structured OCR output", async () => {
  const source = await PDFDocument.create();
  source.addPage([612, 792]);
  source.addPage([792, 612]);
  const pdfBytes = Buffer.from(await source.save());
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith("https://api.openai.com/")) {
      requests.push(JSON.parse(options.body));
      assert.ok(options.headers.Authorization.startsWith("Bearer "));
      const requestContent = JSON.parse(options.body).input[0].content;
      const file = requestContent.find((item) => item.type === "input_file");
      assert.ok(file);
      assert.equal(file.filename, `page-${requests.length}.pdf`);
      return Response.json({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  pageNumber: requests.length,
                  extractedText: `Page ${requests.length}`,
                  recognizedFormulas: ["x + 1 = 2"],
                  readabilityStatus: "readable",
                  ocrConfidence: 0.94,
                  unclearRegions: [],
                }),
              },
            ],
          },
        ],
      });
    }

    return new Response(pdfBytes, { status: 200 });
  };

  try {
    const result = await extractNoteText({
      storage: {
        provider: "cloudinary",
        publicId: "test/note",
        resourceType: "raw",
        format: "pdf",
        mimeType: "application/pdf",
        bytes: pdfBytes.length,
      },
    });

    assert.equal(requests.length, 2);
    assert.deepEqual(result.pages.map((page) => page.pageNumber), [1, 2]);
    assert.deepEqual(result.pages.map((page) => page.extractedText), ["Page 1", "Page 2"]);
    assert.deepEqual(result.pages[0].recognizedFormulas, ["x + 1 = 2"]);
    assert.equal(requests[0].store, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("surfaces Vision API failures without storing a success-shaped OCR result", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) =>
    String(url).startsWith("https://api.openai.com/")
      ? new Response("unavailable", { status: 503 })
      : new Response(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), { status: 200 });

  try {
    await assert.rejects(
      extractNoteText({
        storage: {
          provider: "cloudinary",
          publicId: "test/note",
          resourceType: "image",
          format: "jpg",
          mimeType: "image/jpeg",
          bytes: 4,
        },
      }),
      /Vision API returned HTTP 503/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

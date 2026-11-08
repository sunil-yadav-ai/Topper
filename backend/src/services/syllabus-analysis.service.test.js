import assert from "node:assert/strict";
import test from "node:test";
import { StandardFonts, PDFDocument } from "pdf-lib";

process.env.OPENAI_API_KEY = "test-api-key";
process.env.OPENAI_SYLLABUS_MODEL = "test-syllabus-model";
const {
  extractAndOrganizeSyllabus,
  normalizeSyllabusStructure,
  organizeSyllabusPages,
  splitSyllabusPdfIntoPages,
  validateSyllabusFile,
} = await import("./syllabus-analysis.service.js");
const { topicMatchesResource } = await import("./syllabus-resource.service.js");

const onePageSyllabus = {
  course: "BCA",
  semester: 5,
  subjects: [
    {
      subjectName: "Calculus",
      subjectCode: "BCA-501",
      units: [
        {
          unitNumber: 1,
          unitTitle: "Differentiation",
          topics: [{ topicName: "Chain rule", subtopics: ["Implicit differentiation"] }],
        },
      ],
    },
  ],
};

test("validates syllabus extensions, MIME types, and file signatures", () => {
  assert.deepEqual(
    validateSyllabusFile({
      originalname: "course.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.from("%PDF-1.7"),
    }),
    { format: "pdf", mimeType: "application/pdf" },
  );
  assert.throws(
    () =>
      validateSyllabusFile({
        originalname: "course.pdf",
        mimetype: "image/png",
        buffer: Buffer.from("%PDF-1.7"),
      }),
    /PDF, JPG, JPEG, or PNG/,
  );
  assert.throws(
    () =>
      validateSyllabusFile({
        originalname: "course.png",
        mimetype: "image/png",
        buffer: Buffer.from("not an image"),
      }),
    /contents do not match/,
  );
});

test("splits syllabus PDFs into individually numbered source pages", async () => {
  const document = await PDFDocument.create();
  document.addPage();
  document.addPage();
  const pages = await splitSyllabusPdfIntoPages(Buffer.from(await document.save()));
  assert.deepEqual(pages.map((page) => page.pageNumber), [1, 2]);
  assert.ok(pages.every((page) => page.mimeType === "application/pdf"));
});

test("normalizes student-confirmed structure and rejects invalid topic names", () => {
  assert.deepEqual(
    normalizeSyllabusStructure(onePageSyllabus),
    onePageSyllabus,
  );
  assert.throws(
    () =>
      normalizeSyllabusStructure({
        subjects: [{ name: "Calculus", units: [{ name: "Unit 1", topics: [{ name: "", subtopics: [] }] }] }],
      }),
    /Topic names must contain/,
  );
  assert.throws(
    () =>
      normalizeSyllabusStructure({
        subjects: [{ subjectName: "Calculus", units: [] }],
      }),
    /Each subject must contain between 1 and 40 units/,
  );
});

test("uses backend vision OCR and structured syllabus extraction", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    const result = requests.length === 1
      ? {
          pageNumber: 1,
          extractedText: "Calculus\nUnit 1: Differentiation\nChain rule",
          readabilityStatus: "readable",
        }
      : onePageSyllabus;
    return Response.json({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(result) }] }],
    });
  };

  try {
    const result = await extractAndOrganizeSyllabus(
      {
        originalname: "calculus.png",
        mimetype: "image/png",
        buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      },
      "png",
    );
    assert.deepEqual(result.structure, onePageSyllabus);
    assert.equal(result.pages[0].pageNumber, 1);
    assert.match(requests[0].input[0].content[0].text, /transcribe the syllabus/i);
    assert.equal(requests[0].input[0].content[1].type, "input_image");
    assert.match(requests[1].input[0].content[0].text, /do not infer or invent/i);
    assert.equal(requests[0].store, false);
    assert.equal(requests[0].model, "test-syllabus-model");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("extracts selectable PDF text and OCRs only scanned pages without skipping them", async () => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  document.addPage().drawText(
    "BCA Semester 5 Computer Graphics Unit 1 Introduction to Computer Graphics Applications History Types",
    { x: 40, y: 700, font, size: 12 },
  );
  document.addPage();
  const pdfBytes = Buffer.from(await document.save());
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    const isPageOcr = request.text.format.name === "syllabus_page_ocr";
    if (isPageOcr) {
      const sourceFile = request.input[0].content.find((item) => item.type === "input_file");
      assert.equal(sourceFile.filename, "syllabus-page-2.pdf");
      return Response.json({
        output: [{
          content: [{
            type: "output_text",
            text: JSON.stringify({
              pageNumber: 2,
              extractedText: "Unit 2: 2D transformations",
              readabilityStatus: "readable",
            }),
          }],
        }],
      });
    }
    const sourceText = request.input[0].content[0].text;
    assert.match(sourceText, /Computer Graphics/);
    assert.match(sourceText, /Unit 2: 2D transformations/);
    return Response.json({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(onePageSyllabus) }] }],
    });
  };

  try {
    const result = await extractAndOrganizeSyllabus(
      { originalname: "bca-syllabus.pdf", mimetype: "application/pdf", buffer: pdfBytes },
      "pdf",
    );
    assert.equal(requests.length, 2);
    assert.equal(result.pages.length, 2);
    assert.match(result.pages[0].extractedText, /Computer Graphics/);
    assert.equal(result.pages[1].pageNumber, 2);
    assert.equal(result.pages[1].extractedText, "Unit 2: 2D transformations");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects unreadable pages instead of returning an incomplete outline", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    output: [{
      content: [{
        type: "output_text",
        text: JSON.stringify({
          pageNumber: 1,
          extractedText: "",
          readabilityStatus: "unreadable",
        }),
      }],
    }],
  });
  try {
    await assert.rejects(
      extractAndOrganizeSyllabus(
        {
          originalname: "unreadable.png",
          mimetype: "image/png",
          buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        },
        "png",
      ),
      /Could not read syllabus page 1/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("organizes large source text in chunks and merges repeated syllabus units", async () => {
  const originalFetch = globalThis.fetch;
  const prompts = [];
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    prompts.push(request.input[0].content[0].text);
    const result = prompts.length === 1
      ? {
          ...onePageSyllabus,
          subjects: [{
            ...onePageSyllabus.subjects[0],
            units: [{
              ...onePageSyllabus.subjects[0].units[0],
              topics: [],
            }],
          }],
        }
      : onePageSyllabus;
    return Response.json({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(result) }] }],
    });
  };

  try {
    const structure = await organizeSyllabusPages([
      { pageNumber: 1, extractedText: `First page\n${"context ".repeat(1700)}` },
      { pageNumber: 2, extractedText: "Unit 1: Differentiation\nChain rule" },
    ]);
    assert.ok(prompts.length > 1);
    assert.match(prompts[0], /First page/);
    assert.ok(prompts.some((prompt) => /Unit 1: Differentiation/.test(prompt)));
    assert.deepEqual(structure, onePageSyllabus);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports invalid AI JSON rather than presenting an empty syllabus", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    output: [{ content: [{ type: "output_text", text: "not-json" }] }],
  });
  try {
    await assert.rejects(
      organizeSyllabusPages([{ pageNumber: 1, extractedText: "Computer Graphics" }]),
      /AI service returned invalid organized_syllabus/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("regenerates an outline from the stored syllabus OCR text", async () => {
  const originalFetch = globalThis.fetch;
  let promptText = "";
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    promptText = request.input[0].content[0].text;
    return Response.json({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(onePageSyllabus) }] }],
    });
  };

  try {
    const structure = await organizeSyllabusPages([
      {
        pageNumber: 2,
        extractedText: "Actual syllabus heading\nUnit 1: Differentiation\nChain rule",
      },
    ]);
    assert.deepEqual(structure, onePageSyllabus);
    assert.match(promptText, /Actual syllabus heading/);
    assert.match(promptText, /do not infer or invent/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("matches only resources whose academic metadata contains topic terms", () => {
  const resource = {
    title: "Differentiation Study Notes",
    description: "Examples and practice",
    subject: "Calculus",
    unit: "Differentiation",
    topic: "Chain rule",
  };
  assert.equal(topicMatchesResource("Chain rule", resource), true);
  assert.equal(topicMatchesResource("Fourier series", resource), false);
  assert.equal(
    topicMatchesResource("Fourier series", { ocrText: "The fourier seires transform" }),
    true,
  );
});

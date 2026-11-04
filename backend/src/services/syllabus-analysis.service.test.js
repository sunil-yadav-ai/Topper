import assert from "node:assert/strict";
import test from "node:test";

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
const { PDFDocument } = await import("pdf-lib");

const onePageSyllabus = {
  subjects: [
    {
      name: "Calculus",
      units: [
        {
          name: "Differentiation",
          topics: [{ name: "Chain rule", subtopics: ["Implicit differentiation"] }],
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
    assert.match(promptText, /do not infer or invent/);
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
});

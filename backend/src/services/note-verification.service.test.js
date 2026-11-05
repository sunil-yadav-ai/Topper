import assert from "node:assert/strict";
import test from "node:test";

process.env.OPENAI_API_KEY = "test-api-key";
process.env.OPENAI_VERIFICATION_MODEL = "test-verification-model";
process.env.ACADEMIC_REFERENCE_DOMAINS = "openstax.org,nist.gov";
const { verifyAcademicNotes } = await import("./note-verification.service.js");

function issue(overrides = {}) {
  return {
    pageNumber: 1,
    originalStatement: "The derivative of x^2 is 2x.",
    issueDescription: "This statement is correct.",
    suggestedCorrection: "",
    errorCategory: "incorrect_explanation",
    classification: "CONFIRMED_ERROR",
    confidence: 0.97,
    verificationEvidence: "The reference gives the power rule.",
    referenceUrls: ["https://openstax.org/books/calculus-volume-1"],
    ...overrides,
  };
}

test("requires OCR provenance and actual academic citations to confirm errors", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  let requestHeaders;
  globalThis.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    requestHeaders = options.headers;
    return Response.json({
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                issues: [
                  issue(),
                  issue({
                    originalStatement: "A fabricated statement.",
                    errorCategory: "factual_inaccuracy",
                    referenceUrls: ["https://openstax.org/books/calculus-volume-1"],
                  }),
                  issue({
                    originalStatement: "Another statement from the page.",
                    referenceUrls: [],
                  }),
                  issue({
                    originalStatement: "The derivative of x^2 is 2x.",
                    confidence: 0.62,
                  }),
                ],
                pages: [
                  {
                    pageNumber: 1,
                    verifiableStatementCount: 20,
                    analysisReliable: true,
                    analysisLimitations: [],
                  },
                ],
              }),
              annotations: [
                {
                  type: "url_citation",
                  title: "OpenStax Calculus Volume 1",
                  url: "https://openstax.org/books/calculus-volume-1",
                },
              ],
            },
          ],
        },
      ],
    });
  };

  try {
    const result = await verifyAcademicNotes({
      note: {
        title: "Calculus",
        description: "Derivative rules",
        department: "Mathematics",
        semester: 1,
        subject: "Calculus",
        unit: "Derivatives",
        topic: "Power rule",
      },
      ocrResult: {
        pages: [
          {
            pageNumber: 1,
            extractedText: "The derivative of x^2 is 2x.",
            recognizedFormulas: [],
            readabilityStatus: "readable",
            ocrConfidence: 0.95,
            unclearRegions: [],
          },
        ],
      },
    });

    assert.equal(request.store, false);
    assert.equal(request.model, "test-verification-model");
    assert.ok(requestHeaders.Authorization.startsWith("Bearer "));
    assert.match(request.instructions, /definitions, formulas, calculations/i);
    assert.match(request.instructions, /contradictions/i);
    assert.match(request.instructions, /potential_safety_concern/i);
    assert.match(request.instructions, /potential_copyright_concern/i);
    assert.deepEqual(request.tools[0].filters.allowed_domains, [
      "openstax.org",
      "nist.gov",
    ]);
    assert.equal(result.report.overallClassification, "CONFIRMED_ERROR");
    assert.equal(result.report.confirmedErrorCount, 2);
    assert.equal(result.report.uncertainCount, 2);
    assert.equal(result.report.issues[0].classification, "CONFIRMED_ERROR");
    assert.equal(
      result.report.issues[0].references[0].title,
      "OpenStax Calculus Volume 1",
    );
    assert.equal(result.report.issues[1].classification, "UNCERTAIN");
    assert.match(result.report.issues[1].verificationEvidence, /could not be matched/i);
    assert.equal(result.report.issues[2].classification, "UNCERTAIN");
    assert.deepEqual(result.report.issues[2].references, []);
    assert.equal(result.report.issues[3].classification, "CONFIRMED_ERROR");
    assert.equal(result.report.issues[3].confidence, 0.62);
    assert.equal(result.report.totalVerifiableStatements, 20);
    assert.equal(result.report.analysisReliable, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("accepts uncertain safety and copyright findings for human review", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                issues: [
                  issue({
                    errorCategory: "potential_copyright_concern",
                    classification: "UNCERTAIN",
                    referenceUrls: [],
                  }),
                ],
                pages: [
                  {
                    pageNumber: 1,
                    verifiableStatementCount: 20,
                    analysisReliable: true,
                    analysisLimitations: [],
                  },
                ],
              }),
              annotations: [],
            },
          ],
        },
      ],
    });

  try {
    const result = await verifyAcademicNotes({
      note: {
        title: "Calculus",
        description: "Derivative rules",
        department: "Mathematics",
        semester: 1,
        subject: "Calculus",
        unit: "Derivatives",
        topic: "Power rule",
      },
      ocrResult: {
        pages: [
          {
            pageNumber: 1,
            extractedText: "The derivative of x^2 is 2x.",
            recognizedFormulas: [],
            readabilityStatus: "readable",
            ocrConfidence: 0.95,
            unclearRegions: [],
          },
        ],
      },
    });

    assert.equal(result.report.issues[0].errorCategory, "potential_copyright_concern");
    assert.equal(result.report.issues[0].classification, "UNCERTAIN");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns NO_ISSUE_DETECTED when no substantive issue is found", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                issues: [],
                pages: [
                  {
                    pageNumber: 1,
                    verifiableStatementCount: 5,
                    analysisReliable: true,
                    analysisLimitations: [],
                  },
                ],
              }),
              annotations: [],
            },
          ],
        },
      ],
    });

  try {
    const result = await verifyAcademicNotes({
      note: {
        title: "Biology",
        description: "Cell biology",
        department: "Biology",
        semester: 1,
        subject: "Biology",
        unit: "Cells",
        topic: "Cell membrane",
      },
      ocrResult: {
        pages: [
          {
            pageNumber: 1,
            extractedText: "The cell membrane is selectively permeable.",
            recognizedFormulas: [],
            readabilityStatus: "readable",
            ocrConfidence: 0.98,
            unclearRegions: [],
          },
        ],
      },
    });

    assert.equal(result.report.overallClassification, "NO_ISSUE_DETECTED");
    assert.deepEqual(result.report.issues, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not count statements on OCR-unreadable pages", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                issues: [],
                pages: [
                  {
                    pageNumber: 1,
                    verifiableStatementCount: 12,
                    analysisReliable: true,
                    analysisLimitations: [],
                  },
                ],
              }),
              annotations: [],
            },
          ],
        },
      ],
    });

  try {
    const result = await verifyAcademicNotes({
      note: {
        title: "Physics",
        description: "Motion",
        department: "Physics",
        semester: 1,
        subject: "Physics",
        unit: "Motion",
        topic: "Velocity",
      },
      ocrResult: {
        pages: [
          {
            pageNumber: 1,
            extractedText: "[unclear]",
            recognizedFormulas: [],
            readabilityStatus: "unreadable",
            ocrConfidence: 0.1,
            unclearRegions: ["Entire page"],
          },
        ],
      },
    });

    assert.equal(result.report.pages[0].verifiableStatementCount, 0);
    assert.equal(result.report.pages[0].analysisReliable, false);
    assert.equal(result.report.totalVerifiableStatements, 0);
    assert.equal(result.report.analysisReliable, false);
    assert.equal(result.report.unreadablePageCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("surfaces academic verification API failures for worker retry and human review handling", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });

  try {
    await assert.rejects(
      verifyAcademicNotes({
        note: {
          title: "Calculus",
          description: "Derivative rules",
          department: "Mathematics",
          semester: 1,
          subject: "Calculus",
          unit: "Derivatives",
          topic: "Power rule",
        },
        ocrResult: {
          pages: [
            {
              pageNumber: 1,
              extractedText: "The derivative of x^2 is 2x.",
              recognizedFormulas: [],
              readabilityStatus: "readable",
              ocrConfidence: 0.95,
              unclearRegions: [],
            },
          ],
        },
      }),
      /Academic verification API returned HTTP 503/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

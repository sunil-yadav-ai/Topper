import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePyqMetadata,
  validatePyqPdf,
} from "./pyq-validation.service.js";

const validMetadata = {
  university: "  Example University ",
  college: "Example College",
  department: "Computer Science",
  course: "BSc",
  semester: "4",
  subject: "Algorithms",
  examinationYear: "2025",
  examType: "Final",
};

test("validates the PDF signature and rejects missing or non-PDF content", () => {
  assert.doesNotThrow(() =>
    validatePyqPdf({ buffer: Buffer.from("%PDF-1.7\n") }),
  );
  assert.throws(() => validatePyqPdf(undefined), {
    statusCode: 400,
    message: "Choose a question paper PDF to upload.",
  });
  assert.throws(
    () => validatePyqPdf({ buffer: Buffer.from("not a PDF") }),
    {
      statusCode: 400,
      message: "The uploaded file is not a valid PDF.",
    },
  );
});

test("normalizes valid PYQ metadata", () => {
  assert.deepEqual(parsePyqMetadata(validMetadata), {
    ...validMetadata,
    university: "Example University",
    semester: 4,
    examinationYear: 2025,
  });
});

test("rejects out-of-range semester and examination year", () => {
  assert.throws(
    () => parsePyqMetadata({ ...validMetadata, semester: "13" }),
    { statusCode: 400, message: "Semester must be a whole number between 1 and 12." },
  );
  assert.throws(
    () => parsePyqMetadata({ ...validMetadata, examinationYear: "1899" }),
    { statusCode: 400 },
  );
});

test("rejects missing metadata and unsupported exam types", () => {
  assert.throws(
    () => parsePyqMetadata({ ...validMetadata, subject: "  " }),
    { statusCode: 400 },
  );
  assert.throws(
    () => parsePyqMetadata({ ...validMetadata, examType: "Unrecognized" }),
    { statusCode: 400, message: "Choose a valid exam type." },
  );
});

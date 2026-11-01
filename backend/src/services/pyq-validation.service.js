const examTypes = ["Midterm", "Final", "Supplementary", "Quiz", "Other"];

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function requiredText(body, field, maxLength) {
  const value = typeof body[field] === "string" ? body[field].trim() : "";
  if (!value || value.length > maxLength) {
    throw badRequest(`${field} is required and must be at most ${maxLength} characters.`);
  }
  return value;
}

export function validatePyqPdf(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw badRequest("Choose a question paper PDF to upload.");
  }
  if (file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw badRequest("The uploaded file is not a valid PDF.");
  }
}

export function parsePyqMetadata(body) {
  const semester = Number(body.semester);
  const examinationYear = Number(body.examinationYear);
  const currentYear = new Date().getFullYear();

  if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
    throw badRequest("Semester must be a whole number between 1 and 12.");
  }
  if (
    !Number.isInteger(examinationYear) ||
    examinationYear < 1900 ||
    examinationYear > currentYear + 1
  ) {
    throw badRequest(`Examination year must be between 1900 and ${currentYear + 1}.`);
  }
  if (!examTypes.includes(body.examType)) {
    throw badRequest("Choose a valid exam type.");
  }

  return {
    university: requiredText(body, "university", 160),
    college: requiredText(body, "college", 160),
    department: requiredText(body, "department", 120),
    course: requiredText(body, "course", 120),
    semester,
    subject: requiredText(body, "subject", 160),
    examinationYear,
    examType: body.examType,
  };
}

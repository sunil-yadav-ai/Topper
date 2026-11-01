import { basename } from "node:path";
import mongoose from "mongoose";
import multer from "multer";
import Note from "../models/Note.js";
import NoteOcrJob from "../models/NoteOcrJob.js";
import NoteOcrResult from "../models/NoteOcrResult.js";
import NoteVerificationHistory from "../models/NoteVerificationHistory.js";
import NoteVerificationJob from "../models/NoteVerificationJob.js";
import NoteVerificationResult from "../models/NoteVerificationResult.js";
import NoteDecisionNotification from "../models/NoteDecisionNotification.js";
import Notification from "../models/Notification.js";
import Bookmark from "../models/Bookmark.js";
import StudentResourceAccess from "../models/StudentResourceAccess.js";
import { removeCommunityReportNotifications } from "./note-community.controller.js";
import {
  deleteNoteFile,
  getNoteFormat,
  getPrivateNoteDownloadUrl,
  uploadNoteFile,
  validateNoteFile,
} from "../services/note-storage.service.js";
import { decryptOcrResult } from "../services/note-ocr.service.js";
import { decryptJson } from "../services/encrypted-json.service.js";
import {
  recordResourceAccess,
} from "../services/student-library.service.js";
import { createNotification } from "../services/notification.service.js";

const maxFileSize = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 1 },
  fileFilter(_request, file, callback) {
    if (!getNoteFormat(file.originalname)) {
      const error = new Error("Upload a PDF, JPG, JPEG, or PNG file.");
      error.statusCode = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
});

export const receiveNoteFile = upload.single("file");

function requiredText(body, field, maxLength) {
  const value = typeof body[field] === "string" ? body[field].trim() : "";
  if (!value || value.length > maxLength) {
    const error = new Error(`${field} is required and must be at most ${maxLength} characters.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function serializeNote(note, request) {
  const noteId = note._id.toString();
  return {
    id: noteId,
    title: note.title,
    description: note.description,
    department: note.department,
    batch: note.batch,
    semester: note.semester,
    subject: note.subject,
    unit: note.unit,
    topic: note.topic,
    fileName: note.fileName,
    fileFormat: note.storage.format,
    fileSize: note.storage.bytes,
    verificationStatus:
      note.verificationStatus ??
      (note.ocrStatus === "completed" ? "completed" : "queued"),
    verificationError: note.verificationError ?? null,
    approvalDecision:
      note.approvalDecision ??
      (note.verificationStatus === "completed"
        ? "NEEDS_HUMAN_REVIEW"
        : "PENDING"),
    decisionSource: note.decisionSource ?? "ai",
    moderationReason: note.moderationReason ?? "",
    verifiableStatementCount: note.verifiableStatementCount ?? 0,
    confirmedErrorCount: note.confirmedErrorCount ?? 0,
    mistakePercentage: note.mistakePercentage ?? null,
    humanReviewReason: note.humanReviewReason ?? "",
    publicationStatus: note.publicationStatus ?? "private",
    ocrStatus: note.ocrStatus ?? "queued",
    ocrPageCount: note.ocrPageCount ?? null,
    ocrError: note.ocrError ?? null,
    revisionNumber: note.revisionNumber ?? 1,
    revisionOf: note.revisionOf?.toString() ?? null,
    createdAt: note.createdAt,
    downloadUrl: `${request.baseUrl}/${noteId}/file`,
  };
}

export async function createNote(request, response) {
  if (!request.file) {
    const error = new Error("Choose a note file to upload.");
    error.statusCode = 400;
    throw error;
  }

  const fileInfo = validateNoteFile(request.file);
  const semester = Number(request.body.semester);
  if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
    const error = new Error("Semester must be a whole number between 1 and 12.");
    error.statusCode = 400;
    throw error;
  }

  const fields = {
    title: requiredText(request.body, "title", 200),
    description: requiredText(request.body, "description", 2000),
    department: requiredText(request.body, "department", 120),
    batch: requiredText(request.body, "batch", 30),
    semester,
    subject: requiredText(request.body, "subject", 120),
    unit: requiredText(request.body, "unit", 80),
    topic: requiredText(request.body, "topic", 160),
  };

  const note = await createNoteSubmission({
    fields,
    file: request.file,
    format: fileInfo.format,
    uploadedBy: request.user._id,
  });

  response.status(201).json({
    status: "success",
    message: "Your note was uploaded and queued for AI verification. It is private until verified.",
    note: serializeNote(note, request),
  });
}

async function createNoteSubmission({
  fields,
  file,
  format,
  uploadedBy,
  revisionOf = null,
  revisionRoot = null,
  revisionNumber = 1,
}) {
  const id = new mongoose.Types.ObjectId();
  let storedFile;
  let note;
  try {
    storedFile = await uploadNoteFile(file, format);
    note = await Note.create({
      _id: id,
      ...fields,
      uploadedBy,
      storage: storedFile,
      fileName: basename(file.originalname),
      revisionRoot: revisionRoot ?? id,
      revisionOf,
      revisionNumber,
      approvalDecision: "PENDING",
      publicationStatus: "private",
    });
    await createNotification({
      recipient: uploadedBy,
      type: "note_uploaded",
      title: revisionOf ? "Corrected notes uploaded" : "Notes upload complete",
      message: revisionOf
        ? `"${note.title}" was uploaded as a corrected version and is queued for OCR and AI verification.`
        : `"${note.title}" was uploaded and is queued for OCR and AI verification.`,
      link: "/dashboard",
      dedupeKey: `note-uploaded:${note._id}`,
    });
    await NoteOcrJob.create({ note: note._id });
    await NoteVerificationJob.create({ note: note._id });
  } catch (error) {
    if (note) {
      await Promise.all([
        Notification.deleteOne({ dedupeKey: `note-uploaded:${note._id}` }),
        NoteOcrJob.deleteOne({ note: note._id }),
        NoteVerificationJob.deleteOne({ note: note._id }),
        Note.deleteOne({ _id: note._id }),
      ]);
    }
    if (storedFile) {
      try {
        await deleteNoteFile(storedFile);
      } catch (cleanupError) {
        console.error("Failed to clean up an incomplete note upload.", cleanupError);
      }
    }
    throw error;
  }
  return note;
}

export async function resubmitCorrectedNote(request, response) {
  if (!request.file) {
    const error = new Error("Choose the corrected note file to upload.");
    error.statusCode = 400;
    throw error;
  }
  const parent = await Note.findOne({
    _id: request.params.noteId,
    uploadedBy: request.user._id,
  });
  if (!parent) {
    const error = new Error("Note not found.");
    error.statusCode = 404;
    throw error;
  }
  if (parent.approvalDecision !== "REJECTED") {
    const error = new Error("Only rejected notes can be resubmitted as corrected versions.");
    error.statusCode = 409;
    throw error;
  }

  const rootId = parent.revisionRoot ?? parent._id;
  const latest = await Note.findOne({
    $or: [{ revisionRoot: rootId }, { _id: rootId }],
    uploadedBy: request.user._id,
  })
    .sort({ revisionNumber: -1 })
    .select("_id approvalDecision revisionNumber");
  if (latest && !latest._id.equals(parent._id)) {
    const error = new Error("Resubmit the latest rejected version of this note.");
    error.statusCode = 409;
    throw error;
  }

  const fileInfo = validateNoteFile(request.file);
  const note = await createNoteSubmission({
    fields: {
      title: parent.title,
      description: parent.description,
      department: parent.department,
      batch: parent.batch,
      semester: parent.semester,
      subject: parent.subject,
      unit: parent.unit,
      topic: parent.topic,
    },
    file: request.file,
    format: fileInfo.format,
    uploadedBy: request.user._id,
    revisionOf: parent._id,
    revisionRoot: rootId,
    revisionNumber: (latest?.revisionNumber ?? parent.revisionNumber ?? 1) + 1,
  });

  response.status(201).json({
    status: "success",
    message: "Your corrected version was uploaded and queued for OCR and AI verification.",
    note: serializeNote(note, request),
  });
}

export async function getMyNotes(request, response) {
  const notes = await Note.find({ uploadedBy: request.user._id })
    .sort({ createdAt: -1 })
    .lean();

  response.json({
    status: "success",
    notes: notes.map((note) => serializeNote(note, request)),
  });
}

export async function getPublishedNotes(request, response) {
  const notes = await Note.find({
    publicationStatus: "published",
    approvalDecision: { $in: ["APPROVED", "APPROVED_WITH_WARNING"] },
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  response.json({
    status: "success",
    notes: notes.map((note) => serializeNote(note, request)),
  });
}

export async function downloadMyNote(request, response) {
  const note = await Note.findOne({
    _id: request.params.noteId,
    $or: [
      { uploadedBy: request.user._id },
      {
        publicationStatus: "published",
        approvalDecision: { $in: ["APPROVED", "APPROVED_WITH_WARNING"] },
      },
    ],
  });
  if (!note) {
    const error = new Error("Note not found.");
    error.statusCode = 404;
    throw error;
  }

  await recordResourceAccess({
    userId: request.user._id,
    resourceType: "note",
    resourceId: note._id,
    downloaded: true,
  });
  response.redirect(getPrivateNoteDownloadUrl(note.storage));
}

export async function getMyNoteOcr(request, response) {
  const note = await Note.findOne({
    _id: request.params.noteId,
    uploadedBy: request.user._id,
  }).select("ocrStatus ocrPageCount ocrError");
  if (!note) {
    const error = new Error("Note not found.");
    error.statusCode = 404;
    throw error;
  }

  if (note.ocrStatus !== "completed") {
    response.json({
      status: "success",
      ocrStatus: note.ocrStatus,
      pageCount: note.ocrPageCount ?? null,
      error: note.ocrError ?? null,
      pages: [],
    });
    return;
  }

  const storedResult = await NoteOcrResult.findOne({ note: note._id })
    .select("+encryptedResult")
    .lean();
  if (!storedResult) {
    throw new Error("Completed OCR result is missing from secure storage.");
  }

  response.json({
    status: "success",
    ocrStatus: note.ocrStatus,
    pageCount: note.ocrPageCount,
    error: null,
    ...decryptOcrResult(storedResult.encryptedResult),
  });
}

export async function getMyNoteVerification(request, response) {
  const note = await Note.findOne({
    _id: request.params.noteId,
    uploadedBy: request.user._id,
  }).select(
    "verificationStatus verificationError revisionRoot uploadedBy approvalDecision decisionSource publicationStatus moderatedAt moderationReason moderationHistory verifiableStatementCount confirmedErrorCount mistakePercentage humanReviewReason",
  ).populate("moderationHistory.actor", "fullName");
  if (!note) {
    const error = new Error("Note not found.");
    error.statusCode = 404;
    throw error;
  }

  if (note.verificationStatus !== "completed") {
    response.json({
      status: "success",
      verificationStatus: note.verificationStatus,
      decision: note.approvalDecision,
      finalDecision: note.approvalDecision,
      decisionSource: note.decisionSource,
      publicationStatus: note.publicationStatus,
      moderatedAt: note.moderatedAt,
      moderationReason: note.moderationReason,
      moderationHistory: note.moderationHistory.map((entry) => ({
        actor: entry.actor?.fullName ?? "Administrator",
        decision: entry.decision,
        reason: entry.reason,
        createdAt: entry.createdAt,
      })),
      verifiableStatementCount: note.verifiableStatementCount,
      confirmedErrorCount: note.confirmedErrorCount,
      mistakePercentage: note.mistakePercentage ?? null,
      humanReviewReason: note.humanReviewReason ?? "",
      error: note.verificationError ?? null,
      report: null,
    });
    return;
  }

  const storedResult = await NoteVerificationResult.findOne({ note: note._id })
    .select(
      "+encryptedReport model referenceCount createdAt decision verifiableStatementCount confirmedErrorCount mistakePercentage humanReviewReason",
    )
    .lean();
  if (!storedResult) {
    throw new Error("Completed academic verification report is missing from secure storage.");
  }

  response.json({
    status: "success",
    verificationStatus: note.verificationStatus,
    error: null,
    model: storedResult.model,
    referenceCount: storedResult.referenceCount,
    verifiedAt: storedResult.createdAt,
    decision:
      storedResult.decision ??
      (note.approvalDecision === "PENDING"
        ? "NEEDS_HUMAN_REVIEW"
        : note.approvalDecision),
    finalDecision: note.approvalDecision,
    decisionSource: note.decisionSource,
    publicationStatus: note.publicationStatus,
    moderatedAt: note.moderatedAt,
    moderationReason: note.moderationReason,
    moderationHistory: note.moderationHistory.map((entry) => ({
      actor: entry.actor?.fullName ?? "Administrator",
      decision: entry.decision,
      reason: entry.reason,
      createdAt: entry.createdAt,
    })),
    verifiableStatementCount:
      storedResult.verifiableStatementCount ??
      note.verifiableStatementCount ??
      0,
    confirmedErrorCount:
      storedResult.confirmedErrorCount ?? note.confirmedErrorCount ?? 0,
    mistakePercentage:
      storedResult.mistakePercentage ?? note.mistakePercentage ?? null,
    humanReviewReason:
      storedResult.humanReviewReason ?? note.humanReviewReason ?? "",
    report: decryptJson(storedResult.encryptedReport),
    history: await getVerificationHistory(note),
  });
}

async function getVerificationHistory(note) {
  const rootId = note.revisionRoot ?? note._id;
  const revisions = await Note.find({
    $or: [{ revisionRoot: rootId }, { _id: rootId }],
    uploadedBy: note.uploadedBy,
  })
    .select("_id revisionNumber revisionOf title approvalDecision createdAt")
    .sort({ revisionNumber: 1 })
    .lean();
  const revisionIds = revisions.map((revision) => revision._id);
  const history = await NoteVerificationHistory.find({
    revisionRoot: rootId,
    note: { $in: revisionIds },
  })
    .select("+encryptedReport note attempt decision verifiableStatementCount confirmedErrorCount mistakePercentage humanReviewReason model createdAt")
    .sort({ createdAt: 1 })
    .lean();
  return history.map((entry) => ({
    revisionNumber:
      revisions.find((revision) => revision._id.equals(entry.note))
        ?.revisionNumber ?? 1,
    attempt: entry.attempt,
    decision: entry.decision,
    verifiableStatementCount: entry.verifiableStatementCount,
    confirmedErrorCount: entry.confirmedErrorCount,
    mistakePercentage: entry.mistakePercentage,
    humanReviewReason: entry.humanReviewReason,
    model: entry.model,
    verifiedAt: entry.createdAt,
    report: decryptJson(entry.encryptedReport),
  }));
}

export async function deleteMyNote(request, response) {
  const note = await Note.findOne({
    _id: request.params.noteId,
    uploadedBy: request.user._id,
  });
  if (!note) {
    const error = new Error("Note not found.");
    error.statusCode = 404;
    throw error;
  }

  await deleteNoteFile(note.storage);
  await Promise.all([
    NoteOcrJob.deleteOne({ note: note._id }),
    NoteOcrResult.deleteOne({ note: note._id }),
    NoteVerificationJob.deleteOne({ note: note._id }),
    NoteVerificationResult.deleteOne({ note: note._id }),
    NoteVerificationHistory.deleteMany({ note: note._id }),
    NoteDecisionNotification.deleteOne({ note: note._id }),
    removeCommunityReportNotifications(note._id),
    Bookmark.deleteMany({ resourceType: "note", resource: note._id }),
    StudentResourceAccess.deleteMany({
      resourceType: "note",
      resource: note._id,
    }),
    note.deleteOne(),
  ]);

  response.json({ status: "success", message: "Your note was deleted." });
}

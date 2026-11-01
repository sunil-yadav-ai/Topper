import { basename } from "node:path";
import mongoose from "mongoose";
import multer from "multer";
import Pyq from "../models/Pyq.js";
import PyqReport from "../models/PyqReport.js";
import Bookmark from "../models/Bookmark.js";
import User from "../models/User.js";
import { awardContribution } from "../services/reward.service.js";
import {
  deletePyqPdf,
  getPublicPyqPdfUrl,
  uploadPyqPdf,
} from "../services/pyq-storage.service.js";
import {
  parsePyqMetadata,
  validatePyqPdf,
} from "../services/pyq-validation.service.js";
import {
  getStudentLibrary,
  migrateLegacyPyqBookmarks,
  recordResourceAccess,
  removeLibraryBookmarkByResource,
  saveLibraryBookmark,
} from "../services/student-library.service.js";

const maxFileSize = 20 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 1 },
  fileFilter(_request, file, callback) {
    if (
      !file.originalname.toLowerCase().endsWith(".pdf") ||
      file.mimetype !== "application/pdf"
    ) {
      const error = new Error("Upload a PDF file.");
      error.statusCode = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

const receiveSinglePyqPdf = upload.single("file");
export function receivePyqPdf(request, response, next) {
  receiveSinglePyqPdf(request, response, (error) => {
    if (error) error.uploadKind = "pyq";
    next(error);
  });
}

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

function serializePyq(pyq, savedIds = new Set()) {
  return {
    id: pyq._id.toString(),
    university: pyq.university,
    college: pyq.college,
    department: pyq.department,
    course: pyq.course,
    semester: pyq.semester,
    subject: pyq.subject,
    examinationYear: pyq.examinationYear,
    examType: pyq.examType,
    fileName: pyq.fileName,
    fileSize: pyq.storage.bytes,
    downloadCount: pyq.downloadCount,
    reportCount: pyq.reportCount,
    helpfulCount: pyq.helpfulCount ?? 0,
    approvalStatus: pyq.approvalStatus ?? "pending",
    uploadedBy: pyq.uploadedBy?.fullName ?? "Student",
    isBookmarked: savedIds.has(pyq._id.toString()),
    createdAt: pyq.createdAt,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function browsePyqs(request, response) {
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 12);
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    throw badRequest("Page must be a positive whole number.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw badRequest("Limit must be a whole number between 1 and 50.");
  }

  const filter = { approvalStatus: "approved" };
  for (const [parameter, field, min, max] of [
    ["semester", "semester", 1, 12],
    ["examinationYear", "examinationYear", 1900, new Date().getFullYear() + 1],
  ]) {
    if (request.query[parameter] !== undefined && request.query[parameter] !== "") {
      const value = Number(request.query[parameter]);
      if (!Number.isInteger(value) || value < min || value > max) {
        throw badRequest(`${parameter} is outside the supported range.`);
      }
      filter[field] = value;
    }
  }

  for (const field of ["subject", "university", "college", "department", "course", "examType"]) {
    const value = request.query[field];
    if (typeof value === "string" && value.trim()) {
      filter[field] = { $regex: escapeRegex(value.trim()), $options: "i" };
    }
  }

  const search = typeof request.query.search === "string"
    ? request.query.search.trim().slice(0, 100)
    : "";
  if (search) {
    const expression = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [
      { university: expression },
      { college: expression },
      { department: expression },
      { course: expression },
      { subject: expression },
      { examType: expression },
      { fileName: expression },
    ];
  }

  if (request.user?.role === "student") {
    await migrateLegacyPyqBookmarks(request.user._id);
  }
  const [pyqs, total, bookmarks] = await Promise.all([
    Pyq.find(filter)
      .populate("uploadedBy", "fullName")
      .sort({ examinationYear: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Pyq.countDocuments(filter),
    request.user
      ? Bookmark.find({ user: request.user._id, resourceType: "pyq" })
          .select("resource")
          .lean()
      : null,
  ]);
  const savedIds = new Set((bookmarks ?? []).map((bookmark) => bookmark.resource.toString()));

  response.json({
    status: "success",
    pyqs: pyqs.map((pyq) => serializePyq(pyq, savedIds)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function uploadPyq(request, response) {
  validatePyqPdf(request.file);
  const fields = parsePyqMetadata(request.body);
  const storage = await uploadPyqPdf(request.file);
  try {
    const pyq = await Pyq.create({
      ...fields,
      fileName: basename(request.file.originalname),
      storage,
      uploadedBy: request.user._id,
    });
    response.status(201).json({
      status: "success",
      message: "Question paper submitted for approval before it appears publicly.",
      pyq: serializePyq(pyq),
    });
  } catch (error) {
    try {
      await deletePyqPdf(storage);
    } catch (cleanupError) {
      console.error("Failed to clean up an incomplete PYQ upload.", cleanupError);
    }
    throw error;
  }
}

export async function downloadPyq(request, response) {
  if (!mongoose.isValidObjectId(request.params.pyqId)) {
    throw badRequest("Question paper ID is invalid.");
  }
  const pyq = await Pyq.findOneAndUpdate(
    { _id: request.params.pyqId, approvalStatus: "approved" },
    { $inc: { downloadCount: 1 } },
    { new: true },
  );
  if (!pyq) {
    const error = new Error("Approved question paper not found.");
    error.statusCode = 404;
    throw error;
  }
  if (request.user?.role === "student") {
    await recordResourceAccess({
      userId: request.user._id,
      resourceType: "pyq",
      resourceId: pyq._id,
      downloaded: true,
    });
  }
  response.redirect(getPublicPyqPdfUrl(pyq.storage));
}

export async function getMyBookmarks(request, response) {
  const result = await getStudentLibrary(request.user._id, "saved");
  response.json({
    status: "success",
    pyqs: result.items
      .filter((item) => item.type === "pyq")
      .map((item) => ({
        ...item,
        isBookmarked: true,
        fileName: item.title,
        fileSize: 0,
        downloadCount: item.downloadCount ?? 0,
        reportCount: 0,
        uploadedBy: "Student",
      })),
  });
}

export async function bookmarkPyq(request, response) {
  if (!mongoose.isValidObjectId(request.params.pyqId)) {
    throw badRequest("Question paper ID is invalid.");
  }
  const pyq = await Pyq.findOne({
    _id: request.params.pyqId,
    approvalStatus: "approved",
  }).select("_id");
  if (!pyq) {
    const error = new Error("Question paper not found.");
    error.statusCode = 404;
    throw error;
  }
  await saveLibraryBookmark({
    userId: request.user._id,
    resourceType: "pyq",
    resourceId: pyq._id,
  });
  response.json({ status: "success", message: "Question paper bookmarked." });
}

export async function removePyqBookmark(request, response) {
  if (!mongoose.isValidObjectId(request.params.pyqId)) {
    throw badRequest("Question paper ID is invalid.");
  }
  await removeLibraryBookmarkByResource({
    userId: request.user._id,
    resourceType: "pyq",
    resourceId: request.params.pyqId,
  });
  await User.updateOne(
    { _id: request.user._id },
    { $pull: { savedPyqs: request.params.pyqId } },
  );
  response.json({ status: "success", message: "Bookmark removed." });
}

export async function reportPyq(request, response) {
  if (!mongoose.isValidObjectId(request.params.pyqId)) {
    throw badRequest("Question paper ID is invalid.");
  }
  const pyq = await Pyq.findOne({
    _id: request.params.pyqId,
    approvalStatus: "approved",
  }).select("_id");
  if (!pyq) {
    const error = new Error("Question paper not found.");
    error.statusCode = 404;
    throw error;
  }
  const reason = request.body.reason;
  if (!["incorrect", "duplicate", "other"].includes(reason)) {
    throw badRequest("Choose incorrect, duplicate, or other as the report reason.");
  }
  const details =
    typeof request.body.details === "string" ? request.body.details.trim() : "";
  if (details.length > 1000) throw badRequest("Report details must be 1000 characters or fewer.");

  try {
    await PyqReport.create({
      pyq: pyq._id,
      reportedBy: request.user._id,
      reason,
      details,
    });
  } catch (error) {
    if (error.code === 11000) {
      error.statusCode = 409;
      error.message = "You have already reported this question paper.";
    }
    throw error;
  }
  await Pyq.updateOne({ _id: pyq._id }, { $inc: { reportCount: 1 } });
  response.status(201).json({
    status: "success",
    message: "Thank you. Your report was sent for review.",
  });
}

export async function getPyqsForReview(_request, response) {
  const pyqs = await Pyq.find({
    $or: [
      { approvalStatus: "pending" },
      { approvalStatus: { $exists: false } },
    ],
  })
    .populate("uploadedBy", "fullName email")
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();
  response.json({
    status: "success",
    pyqs: pyqs.map((pyq) => ({
      ...serializePyq(pyq),
      approvalStatus: pyq.approvalStatus ?? "pending",
      uploaderEmail: pyq.uploadedBy?.email ?? "",
      reviewUrl: getPublicPyqPdfUrl(pyq.storage),
    })),
  });
}

export async function reviewPyq(request, response) {
  if (!mongoose.isValidObjectId(request.params.pyqId)) {
    throw badRequest("Question paper ID is invalid.");
  }
  const { approvalStatus } = request.body;
  if (!["approved", "rejected"].includes(approvalStatus)) {
    throw badRequest("approvalStatus must be approved or rejected.");
  }
  const pyq = await Pyq.findOneAndUpdate(
    {
      _id: request.params.pyqId,
      $or: [
        { approvalStatus: "pending" },
        { approvalStatus: { $exists: false } },
      ],
    },
    {
      $set: {
        approvalStatus,
        reviewedBy: request.user._id,
        reviewedAt: new Date(),
      },
    },
    { new: true, runValidators: true },
  );
  if (!pyq) {
    const error = new Error("Pending question paper not found.");
    error.statusCode = 404;
    throw error;
  }
  let rewardMessage = "";
  if (approvalStatus === "approved") {
    try {
      const reward = await awardContribution({
        userId: pyq.uploadedBy,
        reviewerId: request.user._id,
        type: "pyq",
        sourceType: "pyq",
        sourceId: pyq._id,
        title: `${pyq.subject} ${pyq.examinationYear} ${pyq.examType}`,
      });
      rewardMessage = reward.awarded
        ? ` The uploader earned ${reward.points} points.`
        : reward.unfunded
          ? " No points were distributed because the platform reward budget is exhausted."
          : "";
    } catch (error) {
      console.error(`Could not reward the uploader of approved PYQ ${pyq._id}:`, error);
      rewardMessage = " Reward distribution needs administrator follow-up.";
    }
  }
  response.json({
    status: "success",
    message: approvalStatus === "approved"
      ? `Question paper approved and now publicly searchable.${rewardMessage}`
      : "Question paper rejected and kept private.",
    pyq: serializePyq(pyq),
  });
}

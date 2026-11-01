import { basename } from "node:path";
import mongoose from "mongoose";
import multer from "multer";
import SyllabusAnalysis from "../models/SyllabusAnalysis.js";
import { decryptJson } from "../services/encrypted-json.service.js";
import {
  encryptSyllabusAnalysis,
  extractAndOrganizeSyllabus,
  normalizeSyllabusStructure,
  validateSyllabusFile,
} from "../services/syllabus-analysis.service.js";
import { findSyllabusResources } from "../services/syllabus-resource.service.js";

const maxFileSize = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 1 },
  fileFilter(_request, file, callback) {
    const extension = file.originalname.split(".").pop()?.toLowerCase();
    const supported = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
    };
    if (!supported[extension] || supported[extension] !== file.mimetype) {
      const error = new Error("Upload a PDF, JPG, JPEG, or PNG syllabus.");
      error.statusCode = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

export const receiveSyllabusFile = upload.single("file");

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function serializeSummary(analysis) {
  return {
    id: analysis._id.toString(),
    fileName: analysis.fileName,
    pageCount: analysis.pageCount,
    status: analysis.status,
    processingError: analysis.processingError ?? null,
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  };
}

async function findOwnedAnalysis(request) {
  if (!mongoose.isValidObjectId(request.params.analysisId)) {
    throw badRequest("Syllabus analysis ID is invalid.");
  }
  const analysis = await SyllabusAnalysis.findOne({
    _id: request.params.analysisId,
    uploadedBy: request.user._id,
  }).select("+encryptedAnalysis");
  if (!analysis) {
    const error = new Error("Syllabus analysis not found.");
    error.statusCode = 404;
    throw error;
  }
  return analysis;
}

export async function uploadSyllabus(request, response) {
  if (!request.file) {
    throw badRequest("Choose a syllabus PDF or image to upload.");
  }
  const fileInfo = validateSyllabusFile(request.file);
  const emptyEncryptedAnalysis = encryptSyllabusAnalysis({
    pages: [],
    structure: { subjects: [] },
    resources: null,
  });
  const analysis = await SyllabusAnalysis.create({
    uploadedBy: request.user._id,
    fileName: basename(request.file.originalname.replace(/\\/g, "/")).slice(0, 255),
    status: "processing",
    encryptedAnalysis: emptyEncryptedAnalysis,
  });

  try {
    const extracted = await extractAndOrganizeSyllabus(request.file, fileInfo.format);
    analysis.pageCount = extracted.pages.length;
    analysis.status = "review";
    analysis.processingError = undefined;
    analysis.encryptedAnalysis = encryptSyllabusAnalysis({
      ...extracted,
      resources: null,
    });
    await analysis.save();
    response.status(201).json({
      status: "success",
      message: "Syllabus extracted. Review and correct the outline before searching resources.",
      analysis: {
        ...serializeSummary(analysis),
        ...extracted,
      },
    });
  } catch (error) {
    analysis.status = "failed";
    const processingFailed = !error.statusCode || error.statusCode >= 500;
    analysis.processingError = processingFailed
      ? "Syllabus analysis failed. Please try again or upload a clearer file."
      : error.message;
    await analysis.save();
    if (processingFailed) {
      console.error("Syllabus analysis failed:", error);
    }
    response.status(error.statusCode ?? 502).json({
      status: "error",
      message: analysis.processingError,
      analysis: serializeSummary(analysis),
    });
  }
}

export async function listSyllabusAnalyses(request, response) {
  const analyses = await SyllabusAnalysis.find({ uploadedBy: request.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  response.json({
    status: "success",
    analyses: analyses.map(serializeSummary),
  });
}

export async function getSyllabusAnalysis(request, response) {
  const analysis = await findOwnedAnalysis(request);
  const data = decryptJson(analysis.encryptedAnalysis);
  response.json({
    status: "success",
    analysis: {
      ...serializeSummary(analysis),
      ...data,
    },
  });
}

export async function updateSyllabusStructure(request, response) {
  const analysis = await findOwnedAnalysis(request);
  if (!["review", "confirmed"].includes(analysis.status)) {
    throw badRequest("Only an extracted syllabus can be edited.");
  }
  const structure = normalizeSyllabusStructure(request.body?.structure);
  const data = decryptJson(analysis.encryptedAnalysis);
  data.structure = structure;
  data.resources = null;
  analysis.status = "review";
  analysis.processingError = undefined;
  analysis.encryptedAnalysis = encryptSyllabusAnalysis(data);
  await analysis.save();
  response.json({
    status: "success",
    message: "Your corrected syllabus outline has been saved.",
    analysis: {
      ...serializeSummary(analysis),
      ...data,
    },
  });
}

export async function confirmSyllabusAndFindResources(request, response) {
  const analysis = await findOwnedAnalysis(request);
  if (analysis.status !== "review") {
    throw badRequest("Review and save the extracted syllabus before searching resources.");
  }
  const data = decryptJson(analysis.encryptedAnalysis);
  const structure = normalizeSyllabusStructure(data.structure);
  const resources = await findSyllabusResources(structure);
  data.structure = structure;
  data.resources = resources;
  analysis.status = "confirmed";
  analysis.encryptedAnalysis = encryptSyllabusAnalysis(data);
  await analysis.save();
  response.json({
    status: "success",
    message: "Matching approved platform resources are ready.",
    analysis: {
      ...serializeSummary(analysis),
      ...data,
    },
  });
}

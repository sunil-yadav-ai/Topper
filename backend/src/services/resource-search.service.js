import mongoose from "mongoose";
import Note from "../models/Note.js";
import Pyq from "../models/Pyq.js";
import ResourceHelpfulVote from "../models/ResourceHelpfulVote.js";
import Bookmark from "../models/Bookmark.js";
import User from "../models/User.js";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function escapedPrefix(value) {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
}

function parsePage(value, fallback, maximum) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw badRequest(`Value must be a whole number between 1 and ${maximum}.`);
  }
  return parsed;
}

function parseTextFilter(query, field) {
  const value = query[field];
  if (value === undefined || value === "") return "";
  if (typeof value !== "string" || value.trim().length > 160) {
    throw badRequest(`${field} must be 160 characters or fewer.`);
  }
  return value.trim();
}

export function parseResourceSearchQuery(query) {
  const q = parseTextFilter(query, "q");
  if (q.length > 100) throw badRequest("q must be 100 characters or fewer.");
  const resourceType = query.resourceType ?? "";
  if (!["", "note", "pyq"].includes(resourceType)) {
    throw badRequest("resourceType must be note or pyq.");
  }
  const sort = query.sort ?? "recent";
  if (!["recent", "helpful"].includes(sort)) {
    throw badRequest("sort must be recent or helpful.");
  }

  const semesterValue = query.semester;
  let semester;
  if (semesterValue !== undefined && semesterValue !== "") {
    semester = Number(semesterValue);
    if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
      throw badRequest("semester must be a whole number between 1 and 12.");
    }
  }

  return {
    q,
    resourceType,
    sort,
    page: parsePage(query.page, 1, 100),
    limit: parsePage(query.limit, 12, 50),
    semester,
    department: parseTextFilter(query, "department"),
    university: parseTextFilter(query, "university"),
    college: parseTextFilter(query, "college"),
    batch: parseTextFilter(query, "batch"),
    subject: parseTextFilter(query, "subject"),
    unit: parseTextFilter(query, "unit"),
    topic: parseTextFilter(query, "topic"),
  };
}

async function findUploaderIds(filters) {
  const userFilter = {};
  for (const field of ["university", "college", "batch"]) {
    if (filters[field]) userFilter[field] = escapedPrefix(filters[field]);
  }
  if (!Object.keys(userFilter).length) return null;
  return User.distinct("_id", userFilter);
}

function createTextSearch(q) {
  return q ? { $text: { $search: q } } : {};
}

function createNoteFilter(filters, uploaderIds) {
  const filter = {
    publicationStatus: "published",
    approvalDecision: { $in: ["APPROVED", "APPROVED_WITH_WARNING"] },
  };
  if (filters.q) Object.assign(filter, createTextSearch(filters.q));
  if (filters.semester) filter.semester = filters.semester;
  if (filters.department) filter.department = escapedPrefix(filters.department);
  if (filters.subject) filter.subject = escapedPrefix(filters.subject);
  if (filters.unit) filter.unit = escapedPrefix(filters.unit);
  if (filters.topic) filter.topic = escapedPrefix(filters.topic);
  if (uploaderIds) filter.uploadedBy = { $in: uploaderIds };
  return filter;
}

function createPyqFilter(filters, uploaderIds) {
  const filter = { approvalStatus: "approved" };
  if (filters.q) Object.assign(filter, createTextSearch(filters.q));
  if (filters.semester) filter.semester = filters.semester;
  for (const field of ["department", "university", "college", "subject"]) {
    if (filters[field]) filter[field] = escapedPrefix(filters[field]);
  }
  if (uploaderIds) filter.uploadedBy = { $in: uploaderIds };
  return filter;
}

function sortFor(sort) {
  return sort === "helpful"
    ? { helpfulCount: -1, createdAt: -1, _id: 1 }
    : { createdAt: -1, _id: 1 };
}

function asNote(note) {
  return {
    id: note._id.toString(),
    type: "note",
    title: note.title,
    description: note.description,
    department: note.department,
    university: note.uploadedBy?.university ?? "",
    college: note.uploadedBy?.college ?? "",
    batch: note.uploadedBy?.batch ?? "",
    semester: note.semester,
    subject: note.subject,
    unit: note.unit,
    topic: note.topic,
    uploader: note.uploadedBy
      ? {
          fullName: note.uploadedBy.fullName,
          username: note.uploadedBy.username,
        }
      : null,
    fileFormat: note.storage.format,
    pageCount: note.ocrPageCount ?? 1,
    downloadCount: note.downloadCount ?? 0,
    helpfulCount: note.helpfulCount ?? 0,
    createdAt: note.createdAt,
    downloadUrl: `/search/notes/${note._id}/download`,
  };
}

function asPyq(pyq) {
  return {
    id: pyq._id.toString(),
    type: "pyq",
    title: `${pyq.subject} - ${pyq.examinationYear} ${pyq.examType}`,
    description: `${pyq.course} · ${pyq.department}`,
    department: pyq.department,
    university: pyq.university,
    college: pyq.college,
    batch: pyq.uploadedBy?.batch ?? "",
    semester: pyq.semester,
    subject: pyq.subject,
    unit: "",
    topic: "",
    fileFormat: "pdf",
    downloadCount: pyq.downloadCount ?? 0,
    helpfulCount: pyq.helpfulCount ?? 0,
    examinationYear: pyq.examinationYear,
    uploader: pyq.uploadedBy
      ? {
          fullName: pyq.uploadedBy.fullName,
          username: pyq.uploadedBy.username,
        }
      : null,
    createdAt: pyq.createdAt,
    downloadUrl: `/pyqs/${pyq._id}/download`,
  };
}

export async function searchResources(query, userId = null) {
  const filters = parseResourceSearchQuery(query);
  const [uploaderIds, pyqUploaderIds] = await Promise.all([
    findUploaderIds(filters),
    filters.batch
      ? User.distinct("_id", { batch: escapedPrefix(filters.batch) })
      : null,
  ]);
  const noteFilter = createNoteFilter(filters, uploaderIds);
  const pyqFilter = createPyqFilter(filters, pyqUploaderIds);
  const includeNotes =
    filters.resourceType !== "pyq" && (!uploaderIds || uploaderIds.length > 0);
  const includePyqs = filters.resourceType !== "note";
  const sourceLimit = filters.page * filters.limit + 1;
  const order = sortFor(filters.sort);

  const [notes, pyqs, noteCount, pyqCount] = await Promise.all([
    includeNotes
      ? Note.find(noteFilter)
          .populate("uploadedBy", "university college batch fullName username")
          .sort(order)
          .limit(sourceLimit)
          .lean()
      : [],
    includePyqs
      ? Pyq.find(pyqFilter)
          .populate("uploadedBy", "batch fullName username")
          .sort(order)
          .limit(sourceLimit)
          .lean()
      : [],
    includeNotes ? Note.countDocuments(noteFilter) : 0,
    includePyqs ? Pyq.countDocuments(pyqFilter) : 0,
  ]);
  const pageResourceIds = [
    ...notes.map((note) => ({ resourceType: "note", resource: note._id })),
    ...pyqs.map((pyq) => ({ resourceType: "pyq", resource: pyq._id })),
  ];
  const bookmarks =
    userId && pageResourceIds.length
      ? await Bookmark.find({ user: userId, $or: pageResourceIds })
          .select("resourceType resource")
          .lean()
      : [];
  const bookmarkKeys = new Set(
    bookmarks.map((bookmark) => `${bookmark.resourceType}:${bookmark.resource}`),
  );
  const combined = [
    ...notes.map((note) => ({
      ...asNote(note),
      isBookmarked: bookmarkKeys.has(`note:${note._id}`),
    })),
    ...pyqs.map((pyq) => ({
      ...asPyq(pyq),
      isBookmarked: bookmarkKeys.has(`pyq:${pyq._id}`),
    })),
  ].sort((left, right) => {
    if (filters.sort === "helpful" && right.helpfulCount !== left.helpfulCount) {
      return right.helpfulCount - left.helpfulCount;
    }
    const dateDifference = new Date(right.createdAt) - new Date(left.createdAt);
    return dateDifference || left.id.localeCompare(right.id);
  });
  const offset = (filters.page - 1) * filters.limit;
  const total = noteCount + pyqCount;

  return {
    resources: combined.slice(offset, offset + filters.limit),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.ceil(total / filters.limit),
    },
  };
}

function suggestionStages(filter, field, prefix, maxResults) {
  return [
    { $match: { ...filter, [field]: prefix } },
    { $group: { _id: `$${field}` } },
    { $sort: { _id: 1 } },
    { $limit: maxResults },
    { $project: { _id: 0, value: "$_id" } },
  ];
}

export async function suggestResources(query) {
  const prefix = parseTextFilter(query, "q");
  if (prefix.length > 100) throw badRequest("q must be 100 characters or fewer.");
  if (!prefix) return { suggestions: [] };
  const resourceType = query.resourceType ?? "";
  if (!["", "note", "pyq"].includes(resourceType)) {
    throw badRequest("resourceType must be note or pyq.");
  }
  const startsWith = escapedPrefix(prefix);
  const noteFilter = {
    publicationStatus: "published",
    approvalDecision: { $in: ["APPROVED", "APPROVED_WITH_WARNING"] },
  };
  const pyqFilter = { approvalStatus: "approved" };
  const jobs = [];
  if (resourceType !== "pyq") {
    jobs.push(
      Note.aggregate(suggestionStages(noteFilter, "subject", startsWith, 6)),
      Note.aggregate(suggestionStages(noteFilter, "topic", startsWith, 6)),
      Note.aggregate(suggestionStages(noteFilter, "unit", startsWith, 6)),
      Note.aggregate(suggestionStages(noteFilter, "title", startsWith, 6)),
    );
  }
  if (resourceType !== "note") {
    jobs.push(
      Pyq.aggregate(suggestionStages(pyqFilter, "subject", startsWith, 6)),
    );
  }
  const resultSets = await Promise.all(jobs);
  const suggestions = new Map();
  for (const values of resultSets) {
    for (const { value } of values) {
      if (typeof value === "string" && value.trim()) {
        suggestions.set(value.toLocaleLowerCase(), value);
      }
    }
  }
  return {
    suggestions: [...suggestions.values()].sort((left, right) =>
      left.localeCompare(right),
    ).slice(0, 10),
  };
}

export async function markResourceHelpful(resourceType, resourceId, userId) {
  if (!["note", "pyq"].includes(resourceType)) {
    throw badRequest("Resource type must be note or pyq.");
  }
  if (!mongoose.isValidObjectId(resourceId)) {
    throw badRequest("Resource ID is invalid.");
  }
  const filter = resourceType === "note"
    ? {
        _id: resourceId,
        publicationStatus: "published",
        approvalDecision: { $in: ["APPROVED", "APPROVED_WITH_WARNING"] },
      }
    : { _id: resourceId, approvalStatus: "approved" };
  const ResourceModel = resourceType === "note" ? Note : Pyq;
  const resource = await ResourceModel.findOne(filter).select("_id");
  if (!resource) {
    const error = new Error("Approved resource not found.");
    error.statusCode = 404;
    throw error;
  }
  try {
    await ResourceHelpfulVote.create({
      resourceType,
      resource: resource._id,
      user: userId,
    });
  } catch (error) {
    if (error.code === 11000) {
      error.statusCode = 409;
      error.message = "You have already marked this resource as helpful.";
    }
    throw error;
  }
  const updated = await ResourceModel.findOneAndUpdate(
    filter,
    { $inc: { helpfulCount: 1 } },
    { new: true },
  ).select("helpfulCount");
  if (!updated) {
    await ResourceHelpfulVote.deleteOne({
      resourceType,
      resource: resource._id,
      user: userId,
    });
    const error = new Error("Approved resource not found.");
    error.statusCode = 404;
    throw error;
  }
  return updated.helpfulCount;
}

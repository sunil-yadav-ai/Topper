import { markResourceHelpful, searchResources, suggestResources } from "../services/resource-search.service.js";
import mongoose from "mongoose";
import Note from "../models/Note.js";
import { getPrivateNoteDownloadUrl } from "../services/note-storage.service.js";
import {
  migrateLegacyPyqBookmarks,
  recordResourceAccess,
} from "../services/student-library.service.js";

export async function searchResourceCollection(request, response) {
  if (request.user?.role === "user") {
    await migrateLegacyPyqBookmarks(request.user._id);
  }
  const result = await searchResources(request.query, request.user?._id);
  response.json({ status: "success", ...result });
}

export async function suggestResourceCollection(request, response) {
  const result = await suggestResources(request.query);
  response.json({ status: "success", ...result });
}

export async function markSearchResultHelpful(request, response) {
  const helpfulCount = await markResourceHelpful(
    request.params.resourceType,
    request.params.resourceId,
    request.user._id,
  );
  response.json({
    status: "success",
    message: "Thanks for helping students find useful resources.",
    helpfulCount,
  });
}

export async function downloadApprovedNote(request, response) {
  if (!mongoose.isValidObjectId(request.params.noteId)) {
    const error = new Error("Note ID is invalid.");
    error.statusCode = 400;
    throw error;
  }
  const note = await Note.findOneAndUpdate(
    {
      _id: request.params.noteId,
      publicationStatus: "published",
      approvalDecision: { $in: ["APPROVED", "APPROVED_WITH_WARNING"] },
    },
    { $inc: { downloadCount: 1 } },
    { new: true },
  );
  if (!note) {
    const error = new Error("Approved note not found.");
    error.statusCode = 404;
    throw error;
  }
  if (request.user?.role === "user") {
    await recordResourceAccess({
      userId: request.user._id,
      resourceType: "note",
      resourceId: note._id,
      downloaded: true,
    });
  }
  response.redirect(getPrivateNoteDownloadUrl(note.storage));
}

import { Router } from "express";
import {
  createNote,
  deleteMyNote,
  downloadMyNote,
  getMyNotes,
  getMyNoteOcr,
  getMyNoteVerification,
  getPublishedNotes,
  receiveNoteFile,
  resubmitCorrectedNote,
} from "../controllers/note.controller.js";
import {
  createNoteCommunityReport,
  getCommunityReportsForReview,
  getMyNoteCommunityReports,
  respondToNoteCommunityReport,
  reviewNoteCommunityReport,
} from "../controllers/note-community.controller.js";
import { isAdmin, requireAuth, requireRole } from "../middleware/auth.middleware.js";

const noteRouter = Router();

noteRouter.get(
  "/reports/review",
  isAdmin,
  getCommunityReportsForReview,
);
noteRouter.patch(
  "/reports/:reportId/review",
  isAdmin,
  reviewNoteCommunityReport,
);
noteRouter.get(
  "/reports",
  requireAuth,
  requireRole("user"),
  getMyNoteCommunityReports,
);
noteRouter.post(
  "/:noteId/reports",
  requireAuth,
  requireRole("user"),
  createNoteCommunityReport,
);
noteRouter.post(
  "/reports/:reportId/response",
  requireAuth,
  requireRole("user"),
  respondToNoteCommunityReport,
);

noteRouter.use(requireAuth, requireRole("user"));
noteRouter.get("/published", getPublishedNotes);
noteRouter.get("/", getMyNotes);
noteRouter.post("/", receiveNoteFile, createNote);
noteRouter.post("/:noteId/resubmissions", receiveNoteFile, resubmitCorrectedNote);
noteRouter.get("/:noteId/ocr", getMyNoteOcr);
noteRouter.get("/:noteId/verification", getMyNoteVerification);
noteRouter.get("/:noteId/file", downloadMyNote);
noteRouter.delete("/:noteId", deleteMyNote);

export default noteRouter;

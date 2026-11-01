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
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const noteRouter = Router();

noteRouter.get(
  "/reports/review",
  requireAuth,
  requireRole("admin"),
  getCommunityReportsForReview,
);
noteRouter.patch(
  "/reports/:reportId/review",
  requireAuth,
  requireRole("admin"),
  reviewNoteCommunityReport,
);
noteRouter.get(
  "/reports",
  requireAuth,
  requireRole("student"),
  getMyNoteCommunityReports,
);
noteRouter.post(
  "/:noteId/reports",
  requireAuth,
  requireRole("student"),
  createNoteCommunityReport,
);
noteRouter.post(
  "/reports/:reportId/response",
  requireAuth,
  requireRole("student"),
  respondToNoteCommunityReport,
);

noteRouter.use(requireAuth, requireRole("student"));
noteRouter.get("/published", getPublishedNotes);
noteRouter.get("/", getMyNotes);
noteRouter.post("/", receiveNoteFile, createNote);
noteRouter.post("/:noteId/resubmissions", receiveNoteFile, resubmitCorrectedNote);
noteRouter.get("/:noteId/ocr", getMyNoteOcr);
noteRouter.get("/:noteId/verification", getMyNoteVerification);
noteRouter.get("/:noteId/file", downloadMyNote);
noteRouter.delete("/:noteId", deleteMyNote);

export default noteRouter;

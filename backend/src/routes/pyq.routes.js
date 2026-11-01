import { Router } from "express";
import {
  bookmarkPyq,
  browsePyqs,
  downloadPyq,
  getMyBookmarks,
  getPyqsForReview,
  receivePyqPdf,
  removePyqBookmark,
  reportPyq,
  reviewPyq,
  uploadPyq,
} from "../controllers/pyq.controller.js";
import {
  optionalAuth,
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const pyqRouter = Router();

pyqRouter.get(
  "/review",
  requireAuth,
  requireRole("admin"),
  getPyqsForReview,
);
pyqRouter.patch(
  "/:pyqId/approval",
  requireAuth,
  requireRole("admin"),
  reviewPyq,
);
pyqRouter.get("/", optionalAuth, browsePyqs);
pyqRouter.get("/:pyqId/download", optionalAuth, downloadPyq);
pyqRouter.post("/", requireAuth, requireRole("student"), receivePyqPdf, uploadPyq);
pyqRouter.get(
  "/bookmarks",
  requireAuth,
  requireRole("student"),
  getMyBookmarks,
);
pyqRouter.post(
  "/:pyqId/bookmark",
  requireAuth,
  requireRole("student"),
  bookmarkPyq,
);
pyqRouter.delete(
  "/:pyqId/bookmark",
  requireAuth,
  requireRole("student"),
  removePyqBookmark,
);
pyqRouter.post(
  "/:pyqId/reports",
  requireAuth,
  requireRole("student"),
  reportPyq,
);

export default pyqRouter;

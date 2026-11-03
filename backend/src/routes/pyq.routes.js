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
  isAdmin,
  optionalAuth,
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const pyqRouter = Router();

pyqRouter.get(
  "/review",
  isAdmin,
  getPyqsForReview,
);
pyqRouter.patch(
  "/:pyqId/approval",
  isAdmin,
  reviewPyq,
);
pyqRouter.get("/", optionalAuth, browsePyqs);
pyqRouter.get("/:pyqId/download", optionalAuth, downloadPyq);
pyqRouter.post("/", requireAuth, requireRole("user"), receivePyqPdf, uploadPyq);
pyqRouter.get(
  "/bookmarks",
  requireAuth,
  requireRole("user"),
  getMyBookmarks,
);
pyqRouter.post(
  "/:pyqId/bookmark",
  requireAuth,
  requireRole("user"),
  bookmarkPyq,
);
pyqRouter.delete(
  "/:pyqId/bookmark",
  requireAuth,
  requireRole("user"),
  removePyqBookmark,
);
pyqRouter.post(
  "/:pyqId/reports",
  requireAuth,
  requireRole("user"),
  reportPyq,
);

export default pyqRouter;

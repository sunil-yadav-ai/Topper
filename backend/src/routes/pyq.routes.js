import { Router } from "express";
import {
  bookmarkPyq,
  browsePyqs,
  getMyUploadedPyqs,
  getMyBookmarks,
  receivePyqPdf,
  removePyqBookmark,
  reportPyq,
  uploadPyq,
} from "../controllers/pyq.controller.js";
import {
  optionalAuth,
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const pyqRouter = Router();

pyqRouter.get(
  "/mine",
  requireAuth,
  requireRole("user"),
  getMyUploadedPyqs,
);
pyqRouter.get("/", optionalAuth, browsePyqs);
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

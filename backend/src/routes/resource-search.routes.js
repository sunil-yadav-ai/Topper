import { Router } from "express";
import {
  getResourceSearchOptionsCollection,
  downloadApprovedNote,
  markSearchResultHelpful,
  searchResourceCollection,
  suggestResourceCollection,
} from "../controllers/resource-search.controller.js";
import {
  optionalAuth,
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const resourceSearchRouter = Router();

resourceSearchRouter.get("/", optionalAuth, searchResourceCollection);
resourceSearchRouter.get("/options", getResourceSearchOptionsCollection);
resourceSearchRouter.get("/suggestions", suggestResourceCollection);
resourceSearchRouter.get(
  "/notes/:noteId/download",
  optionalAuth,
  downloadApprovedNote,
);
resourceSearchRouter.post(
  "/:resourceType/:resourceId/helpful",
  requireAuth,
  requireRole("user"),
  markSearchResultHelpful,
);

export default resourceSearchRouter;

import { Router } from "express";
import multer from "multer";
import {
  getPublicProfile,
  updateOwnProfile,
} from "../controllers/profile.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const profileRouter = Router();
const receiveProfileImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 2 },
}).fields([
  { name: "avatar", maxCount: 1 },
  { name: "cover", maxCount: 1 },
]);

profileRouter.get("/:username", getPublicProfile);
profileRouter.patch("/me", requireAuth, receiveProfileImages, updateOwnProfile);

export default profileRouter;

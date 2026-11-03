import { Router } from "express";
import multer from "multer";
import {
  getPublicProfile,
  updateOwnProfile,
} from "../controllers/profile.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const profileRouter = Router();
const receiveProfilePhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single("avatar");

profileRouter.get("/:username", getPublicProfile);
profileRouter.patch("/me", requireAuth, receiveProfilePhoto, updateOwnProfile);

export default profileRouter;

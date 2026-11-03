import { Router } from "express";
import {
  adjustStudentRewards,
  awardHighQualityResource,
  getAdminRewardsOverview,
  getMyRewards,
  getRewardsLeaderboard,
} from "../controllers/rewards.controller.js";
import { isAdmin, requireAuth, requireRole } from "../middleware/auth.middleware.js";

const rewardsRouter = Router();

rewardsRouter.get(
  "/me",
  requireAuth,
  requireRole("user"),
  getMyRewards,
);
rewardsRouter.get(
  "/leaderboard",
  requireAuth,
  requireRole("user"),
  getRewardsLeaderboard,
);
rewardsRouter.get(
  "/admin/overview",
  isAdmin,
  getAdminRewardsOverview,
);
rewardsRouter.post(
  "/admin/adjust",
  isAdmin,
  adjustStudentRewards,
);
rewardsRouter.post(
  "/admin/quality-bonus",
  isAdmin,
  awardHighQualityResource,
);

export default rewardsRouter;

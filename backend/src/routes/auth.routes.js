import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  forgotPassword,
  getCurrentUser,
  loginAdmin,
  loginStudent,
  logout,
  registerStudent,
  resendVerificationEmail,
  resetPassword,
  verifyEmail,
} from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const authRouter = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many authentication requests. Please try again later.",
  },
});

authRouter.use(authLimiter);
authRouter.post("/register", registerStudent);
authRouter.post("/login", loginStudent);
authRouter.post("/admin/login", loginAdmin);
authRouter.get("/me", requireAuth, getCurrentUser);
authRouter.post("/logout", logout);
authRouter.post("/verify-email", verifyEmail);
authRouter.post("/resend-verification", resendVerificationEmail);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);
authRouter.get("/admin", requireAuth, requireRole("admin"), (_request, response) => {
  response.json({ status: "success", message: "Admin access granted." });
});

export default authRouter;

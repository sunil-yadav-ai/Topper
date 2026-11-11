import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { env, isAllowedCorsOrigin } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRouter from "./routes/auth.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import healthRouter from "./routes/health.routes.js";
import noteRouter from "./routes/note.routes.js";
import pyqRouter from "./routes/pyq.routes.js";
import resourceSearchRouter from "./routes/resource-search.routes.js";
import studentLibraryRouter from "./routes/student-library.routes.js";
import syllabusAnalysisRouter from "./routes/syllabus-analysis.routes.js";
import rewardsRouter from "./routes/rewards.routes.js";
import adminRouter from "./routes/admin.routes.js";
import notificationsRouter from "./routes/notifications.routes.js";
import profileRouter from "./routes/profile.routes.js";
import learningTutorRouter from "./routes/learning-tutor.routes.js";
import learningActivityRouter from "./routes/learning-activity.routes.js";
import aiPracticeRouter from "./routes/ai-practice.routes.js";
import seoRouter from "./routes/seo.routes.js";

const app = express();

app.use(
  cors({
    exposedHeaders: [
      "Accept-Ranges",
      "Content-Length",
      "Content-Range",
      "X-Resource-Format",
      "X-Resource-Name",
      "X-Resource-Uploader",
    ],
    origin(origin, callback) {
      callback(null, !origin || isAllowedCorsOrigin(origin));
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(seoRouter);
app.get("/", (_request, response) => {
  response.json({ name: "Student Academic Resource Sharing API" });
});
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/notes", noteRouter);
app.use("/api/pyqs", pyqRouter);
app.use("/api/search", resourceSearchRouter);
app.use("/api/library", studentLibraryRouter);
app.use("/api/syllabus-analyses", syllabusAnalysisRouter);
app.use("/api/rewards", rewardsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/profiles", profileRouter);
app.use("/api/learning-tutor", learningTutorRouter);
app.use("/api/learning-activity", learningActivityRouter);
app.use("/api/ai-practice", aiPracticeRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

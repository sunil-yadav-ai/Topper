import { Router } from "express";
import {
  confirmSyllabusAndFindResources,
  getSyllabusAnalysis,
  listSyllabusAnalyses,
  regenerateSyllabusStructure,
  receiveSyllabusFile,
  updateSyllabusStructure,
  uploadSyllabus,
} from "../controllers/syllabus-analysis.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const syllabusAnalysisRouter = Router();

syllabusAnalysisRouter.use(requireAuth, requireRole("user"));
syllabusAnalysisRouter.get("/", listSyllabusAnalyses);
syllabusAnalysisRouter.post("/", receiveSyllabusFile, uploadSyllabus);
syllabusAnalysisRouter.get("/:analysisId", getSyllabusAnalysis);
syllabusAnalysisRouter.put("/:analysisId", updateSyllabusStructure);
syllabusAnalysisRouter.post("/:analysisId/regenerate", regenerateSyllabusStructure);
syllabusAnalysisRouter.post(
  "/:analysisId/confirm",
  confirmSyllabusAndFindResources,
);

export default syllabusAnalysisRouter;

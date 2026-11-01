import { env } from "../config/env.js";

export function decideNoteApproval(
  report,
  minimumStatements = env.minimumVerifiableStatements,
) {
  const verifiableStatementCount = Number.isInteger(report.totalVerifiableStatements)
    ? report.totalVerifiableStatements
    : 0;
  const confirmedErrorCount = (report.issues ?? []).filter(
    (issue) => issue.classification === "CONFIRMED_ERROR",
  ).length;
  const unreadablePageCount = report.unreadablePageCount ?? 0;
  const humanReviewReason =
    !report.analysisReliable ||
    !Array.isArray(report.pages) ||
    (report.pages.length > 0 && unreadablePageCount === report.pages.length)
      ? "The document could not be reliably analyzed; human review is required."
      : verifiableStatementCount < minimumStatements
        ? `Only ${verifiableStatementCount} verifiable statements were found; at least ${minimumStatements} are required for automatic approval.`
        : "";

  if (humanReviewReason) {
    return {
      decision: "NEEDS_HUMAN_REVIEW",
      verifiableStatementCount,
      confirmedErrorCount,
      mistakePercentage: null,
      humanReviewReason,
    };
  }

  const mistakePercentage =
    (confirmedErrorCount / verifiableStatementCount) * 100;
  return {
    decision:
      mistakePercentage <= 5
        ? "APPROVED"
        : mistakePercentage <= 10
          ? "APPROVED_WITH_WARNING"
          : "REJECTED",
    verifiableStatementCount,
    confirmedErrorCount,
    mistakePercentage,
    humanReviewReason: "",
  };
}

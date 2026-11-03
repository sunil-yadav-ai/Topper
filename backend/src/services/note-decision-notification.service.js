import Note from "../models/Note.js";
import User from "../models/User.js";
import { sendEmailSafely } from "./email-notification.service.js";

function notificationText(note, studentName) {
  const percent =
    note.mistakePercentage === null || note.mistakePercentage === undefined
      ? "Not calculated; human review is required."
      : `${note.mistakePercentage.toFixed(2)}%`;
  const messages = {
    APPROVED: "Your notes have been approved.",
    APPROVED_WITH_WARNING:
      "Your notes have been approved with a warning. Please review the suggested corrections.",
    REJECTED:
      "Your notes were not approved. Review the report and upload a corrected version for another review.",
    NEEDS_HUMAN_REVIEW:
      "Your notes need a human review. They remain private while awaiting review.",
  };

  return [
    `Hello ${studentName},`,
    "",
    messages[note.approvalDecision],
    `Title: ${note.title}`,
    `Decision: ${note.approvalDecision}`,
    `Confirmed errors: ${note.confirmedErrorCount}`,
    `Verifiable statements: ${note.verifiableStatementCount}`,
    `Mistake percentage: ${percent}`,
    note.humanReviewReason ? `Review reason: ${note.humanReviewReason}` : "",
    "Your original notes have not been changed.",
    "Sign in to your Topper dashboard to review the detailed page-by-page report.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendNoteDecisionEmail(noteId) {
  try {
    const note = await Note.findById(noteId);
    const student = note
      ? await User.findById(note.uploadedBy).select("email fullName")
      : null;
    if (!note || !student) {
      console.error(`Could not prepare note decision email for note ${noteId}: recipient or note not found.`);
      return false;
    }

    return await sendEmailSafely({
      id: `note-decision-${noteId}-${note.approvalDecision}`,
      to: student.email,
      subject: `Note review result: ${note.title}`,
      text: notificationText(note, student.fullName),
    });
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "UNKNOWN";
    console.error(`Could not prepare note decision email for note ${noteId} (code: ${code}).`);
    return false;
  }
}

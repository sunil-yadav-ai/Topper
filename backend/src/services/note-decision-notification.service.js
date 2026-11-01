import Note from "../models/Note.js";
import NoteDecisionNotification from "../models/NoteDecisionNotification.js";
import User from "../models/User.js";
import { sendActionEmail } from "./email.service.js";

const maxAttempts = 5;

function notificationText(note) {
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
    `Hello ${note.studentName},`,
    "",
    messages[note.approvalDecision],
    `Title: ${note.title}`,
    `Decision: ${note.approvalDecision}`,
    `Confirmed errors: ${note.confirmedErrorCount}`,
    `Verifiable statements: ${note.verifiableStatementCount}`,
    `Mistake percentage: ${percent}`,
    note.humanReviewReason ? `Review reason: ${note.humanReviewReason}` : "",
    "Your original notes have not been changed.",
    "Sign in to your StudyShare dashboard to review the detailed page-by-page report.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function queueNoteDecisionNotification(noteId) {
  await NoteDecisionNotification.findOneAndUpdate(
    { note: noteId },
    { $setOnInsert: { note: noteId, status: "queued" } },
    { upsert: true, new: true, runValidators: true },
  );
}

export async function processNoteDecisionNotification() {
  const staleLease = new Date(Date.now() - 5 * 60 * 1000);
  const notification = await NoteDecisionNotification.findOneAndUpdate(
    {
      attempts: { $lt: maxAttempts },
      $or: [
        { status: "queued" },
        { status: "sending", leaseAt: { $lt: staleLease } },
      ],
    },
    {
      $set: { status: "sending", leaseAt: new Date() },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, new: true },
  );
  if (!notification) return;

  try {
    const note = await Note.findById(notification.note);
    const student = note
      ? await User.findById(note.uploadedBy).select("email fullName")
      : null;
    if (!note || !student) {
      throw new Error("The note or its student could not be found for notification.");
    }

    await sendActionEmail({
      to: student.email,
      subject: `Note review result: ${note.title}`,
      text: notificationText({ ...note.toObject(), studentName: student.fullName }),
    });
    await notification.updateOne({
      $set: {
        status: "sent",
        sentAt: new Date(),
        leaseAt: null,
        lastError: "",
      },
    });
  } catch (error) {
    console.error(
      `Could not notify the owner of note ${notification.note}:`,
      error,
    );
    await notification.updateOne({
      $set: {
        status: notification.attempts >= maxAttempts ? "failed" : "queued",
        leaseAt: null,
        lastError: "Email delivery failed. The system will retry automatically.",
      },
    });
  }
}

import mongoose from "mongoose";

const noteDecisionNotificationSchema = new mongoose.Schema(
  {
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      required: true,
    },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "failed"],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, min: 0, default: 0 },
    leaseAt: { type: Date },
    lastError: { type: String, maxlength: 300, default: "" },
    sentAt: { type: Date },
  },
  { timestamps: true },
);

noteDecisionNotificationSchema.index({ note: 1 }, { unique: true });
noteDecisionNotificationSchema.index({ status: 1, createdAt: 1 });

const NoteDecisionNotification = mongoose.model(
  "NoteDecisionNotification",
  noteDecisionNotificationSchema,
);

export default NoteDecisionNotification;

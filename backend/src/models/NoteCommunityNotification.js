import mongoose from "mongoose";

const noteCommunityNotificationSchema = new mongoose.Schema(
  {
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NoteCommunityReport",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: { type: String, required: true, maxlength: 200 },
    text: { type: String, required: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "failed"],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, min: 0, default: 0 },
    leaseAt: { type: Date, default: null },
    lastError: { type: String, maxlength: 300, default: "" },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

noteCommunityNotificationSchema.index({ status: 1, createdAt: 1 });

const NoteCommunityNotification = mongoose.model(
  "NoteCommunityNotification",
  noteCommunityNotificationSchema,
);

export default NoteCommunityNotification;

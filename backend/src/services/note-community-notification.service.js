import NoteCommunityNotification from "../models/NoteCommunityNotification.js";
import User from "../models/User.js";
import { sendActionEmail } from "./email.service.js";

const maxAttempts = 5;

export async function queueCommunityReportNotification({
  report,
  recipient,
  subject,
  text,
}) {
  await NoteCommunityNotification.create({
    report,
    recipient,
    subject,
    text,
    status: "queued",
  });
}

export async function processCommunityReportNotification() {
  const staleLease = new Date(Date.now() - 5 * 60 * 1000);
  const notification = await NoteCommunityNotification.findOneAndUpdate(
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
    const user = await User.findById(notification.recipient).select("email");
    if (!user) throw new Error("Community report notification recipient not found.");
    await sendActionEmail({
      to: user.email,
      subject: notification.subject,
      text: notification.text,
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
      `Could not deliver community report notification ${notification._id}:`,
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

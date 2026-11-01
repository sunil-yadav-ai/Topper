import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter;

function getTransporter() {
  const smtpSettings = [
    env.smtpHost,
    env.smtpUser,
    env.smtpPassword,
    env.emailFrom,
  ];

  if (smtpSettings.some((setting) => !setting)) {
    const error = new Error(
      "Email delivery is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and EMAIL_FROM.",
    );
    error.statusCode = 503;
    throw error;
  }

  transporter ??= nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPassword },
  });

  return transporter;
}

export async function sendActionEmail({ to, subject, text }) {
  await getTransporter().sendMail({
    from: env.emailFrom,
    to,
    subject,
    text,
  });
}

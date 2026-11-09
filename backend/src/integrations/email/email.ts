import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

const transport =
  env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      })
    : null;

export const emailConfigured = Boolean(transport && env.EMAIL_FROM);

export async function sendPasswordReset(
  recipient: { name: string; email: string },
  token: string,
) {
  if (!transport || !env.EMAIL_FROM)
    throw new Error("Email provider is not configured");
  const resetUrl = new URL("/login", env.FRONTEND_URL);
  resetUrl.searchParams.set("reset", token);
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: recipient.email,
    subject: "Reset your FestiQO password",
    text: `Hello ${recipient.name}, reset your password using this one-time link: ${resetUrl.toString()}. It expires in 30 minutes.`,
    html: `<p>Hello ${recipient.name.replace(/[&<>"']/g, "")},</p><p><a href="${resetUrl.toString()}">Reset your FestiQO password</a></p><p>This one-time link expires in 30 minutes.</p>`,
  });
}

export async function sendAuthOtp(
  recipient: { name: string; email: string },
  code: string,
  purpose: "signup" | "password_reset",
) {
  if (!transport || !env.EMAIL_FROM)
    throw new Error("Email provider is not configured");
  const isSignup = purpose === "signup";
  const name = recipient.name.replace(/[&<>"']/g, "");
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: recipient.email,
    subject: isSignup ? "Verify your FestiQO email" : "Your FestiQO password reset code",
    text: `Hello ${recipient.name}, your ${isSignup ? "email verification" : "password reset"} code is ${code}. It expires in 10 minutes. If you did not request this code, ignore this email.`,
    html: `<p>Hello ${name},</p><p>Your ${isSignup ? "email verification" : "password reset"} code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p>`,
  });
}

export async function sendAnnouncementEmails(
  recipients: { name: string; email: string }[],
  title: string,
  message: string,
) {
  if (!transport || !env.EMAIL_FROM)
    throw new Error("Email provider is not configured");
  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]!);
  let sent = 0;
  let failed = 0;
  let nextBatch = 0;
  const batches: { name: string; email: string }[][] = [];
  for (let index = 0; index < recipients.length; index += 50)
    batches.push(recipients.slice(index, index + 50));
  const sendNext = async () => {
    while (nextBatch < batches.length) {
      const batch = batches[nextBatch++]!;
      try {
        const result = await transport.sendMail({
          from: env.EMAIL_FROM,
          to: env.EMAIL_FROM,
          bcc: batch.map(({ email }) => email),
          subject: title,
          text: `${title}\n\n${message}`,
          html: `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(message).replace(/\r?\n/g, "<br>")}</p><p>FestiQO announcement</p>`,
        });
        sent += result.accepted.length;
        failed += result.rejected.length;
      } catch {
        failed += batch.length;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, batches.length) }, sendNext));
  return { sent, failed };
}

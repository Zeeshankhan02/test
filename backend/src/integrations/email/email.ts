import nodemailer from "nodemailer";
import { Readable } from "node:stream";
import { env } from "../../config/env.js";

const mimeTransport = nodemailer.createTransport({ streamTransport: true, buffer: true });

export const emailConfigured = Boolean(
  env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.GOOGLE_REFRESH_TOKEN &&
    env.EMAIL_FROM,
);

async function sendEmail(input: {
  to?: string;
  bcc?: string[];
  subject: string;
  text: string;
  html: string;
}) {
  if (
    !emailConfigured ||
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.GOOGLE_REFRESH_TOKEN ||
    !env.EMAIL_FROM
  )
    throw new Error("Gmail API email is not configured");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const tokenResult = await tokenResponse.json() as { access_token?: string; error?: string };
  if (!tokenResponse.ok || !tokenResult.access_token)
    throw new Error(`Google OAuth token request failed (${tokenResponse.status}): ${tokenResult.error || "No access token returned"}`);

  const { message } = await mimeTransport.sendMail({
    from: env.EMAIL_FROM,
    to: input.to,
    bcc: input.bcc,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  const mime = Buffer.isBuffer(message)
    ? message
    : await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        (message as Readable).on("data", (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
        (message as Readable).once("end", () => resolve(Buffer.concat(chunks)));
        (message as Readable).once("error", reject);
      });
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenResult.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw: mime.toString("base64url") }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gmail API send failed (${response.status}): ${detail.slice(0, 500)}`);
  }
}

export async function sendPasswordReset(
  recipient: { name: string; email: string },
  token: string,
) {
  const resetUrl = new URL("/login", env.FRONTEND_URL);
  resetUrl.searchParams.set("reset", token);
  await sendEmail({
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
  const isSignup = purpose === "signup";
  const name = recipient.name.replace(/[&<>"']/g, "");
  await sendEmail({
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
        await sendEmail({
          bcc: batch.map(({ email }) => email),
          subject: title,
          text: `${title}\n\n${message}`,
          html: `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(message).replace(/\r?\n/g, "<br>")}</p><p>FestiQO announcement</p>`,
        });
        sent += batch.length;
      } catch {
        failed += batch.length;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, batches.length) }, sendNext));
  return { sent, failed };
}

import nodemailer from "nodemailer";
import { Readable } from "node:stream";
import { env } from "../../config/env.js";

const mimeTransport = nodemailer.createTransport({ streamTransport: true, buffer: true });
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);

function emailLayout(preheader: string, content: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f8;color:#252a35;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f8;padding:32px 12px"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e9e9ed;border-radius:12px;overflow:hidden">
        <tr><td style="background:#7456ec;padding:22px 28px;color:#fff"><div style="font-size:22px;font-weight:700;letter-spacing:.2px">FestiQO</div><div style="margin-top:4px;font-size:12px;color:#eee9ff">College fest updates</div></td></tr>
        <tr><td style="padding:30px 28px 24px">${content}</td></tr>
        <tr><td style="border-top:1px solid #e9e9ed;padding:18px 28px;color:#777b87;font-size:12px;line-height:1.6">This message was sent by FestiQO. If you did not expect it, you can ignore this email.</td></tr>
      </table>
      <div style="padding:16px 8px;color:#8a909d;font-size:11px">FestiQO | College fest, all in one place</div>
    </td></tr></table>
  </body></html>`;
}

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
  const safeUrl = escapeHtml(resetUrl.toString());
  await sendEmail({
    to: recipient.email,
    subject: "Reset your FestiQO password",
    text: `Hello ${recipient.name},\n\nUse this link to choose a new FestiQO password:\n${resetUrl.toString()}\n\nThis link expires in 30 minutes. If you did not request a password reset, you can ignore this email.\n\nFestiQO`,
    html: emailLayout("Reset your FestiQO password", `<h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#252a35">Reset your password</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#525866">Hello ${escapeHtml(recipient.name)},</p><p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#525866">Use the button below to choose a new password for your FestiQO account.</p><p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;border-radius:7px;background:#7456ec;padding:13px 20px;color:#fff;font-size:14px;font-weight:700;text-decoration:none">Reset password</a></p><p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6f7582">This link expires in 30 minutes. If the button does not work, copy this address into your browser:</p><p style="margin:0 0 16px;word-break:break-all;font-size:12px;line-height:1.6"><a href="${safeUrl}" style="color:#6749df">${safeUrl}</a></p><p style="margin:0;font-size:13px;line-height:1.6;color:#6f7582">If you did not request a password reset, you can ignore this email.</p>`),
  });
}

export async function sendAuthOtp(
  recipient: { name: string; email: string },
  code: string,
  purpose: "signup" | "password_reset",
) {
  const isSignup = purpose === "signup";
  const purposeLabel = isSignup ? "email verification" : "password reset";
  await sendEmail({
    to: recipient.email,
    subject: isSignup ? "Verify your FestiQO email" : "Your FestiQO password reset code",
    text: `Hello ${recipient.name},\n\nYour FestiQO ${purposeLabel} code is:\n\n${code}\n\nThis code expires in 10 minutes. For your security, do not share it with anyone. If you did not request it, you can ignore this email.\n\nFestiQO`,
    html: emailLayout(`Your ${purposeLabel} code is ${code}`, `<h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#252a35">${isSignup ? "Verify your email" : "Reset your password"}</h1><p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#525866">Hello ${escapeHtml(recipient.name)}, use this one-time code to continue:</p><div style="margin:0 0 20px;border:1px solid #e9e5ff;border-radius:9px;background:#f7f5ff;padding:18px;text-align:center;color:#38277e;font-size:32px;font-weight:700;letter-spacing:8px">${code}</div><p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#6f7582">This code expires in 10 minutes. For your security, never share it with anyone.</p><p style="margin:0;font-size:13px;line-height:1.6;color:#6f7582">If you did not request this code, you can ignore this email.</p>`),
  });
}

export async function sendAnnouncementEmails(
  recipients: { name: string; email: string }[],
  title: string,
  message: string,
) {
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
          text: `${title}\n\n${message}\n\nYour FestiQO organizers`,
          html: emailLayout("A new announcement from FestiQO", `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#252a35">${escapeHtml(title)}</h1><div style="font-size:15px;line-height:1.75;color:#525866">${escapeHtml(message).replace(/\r?\n/g, "<br>")}</div><p style="margin:24px 0 0;font-size:13px;color:#6f7582">Your FestiQO organizers</p>`),
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

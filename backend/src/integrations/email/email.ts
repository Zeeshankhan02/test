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

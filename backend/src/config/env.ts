import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

/**
 * Optional string that also trims the value and strips surrounding quotes.
 * dotenv keeps literal quotes in values like CLOUDINARY_API_KEY="1234567890",
 * and copy/pasted credentials often carry trailing spaces or newlines; both
 * silently break Cloudinary signature checks with a confusing 502.
 */
const trimmedOptionalString = z.preprocess((value) => {
  if (typeof value !== "string") return value === "" ? undefined : value;
  // Strip surrounding quotes first, then whitespace — copy/pasted .env values
  // commonly arrive as ` "my-cloud" `, `\"key\"\n`, etc.
  const cleaned = value.replace(/^\s*["'](.*)["']\s*$/s, "$1").trim();
  return cleaned === "" ? undefined : cleaned;
}, z.string().optional());

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    MONGODB_URI: z.string().min(1),
    FRONTEND_URL: z.string().url(),
    CORS_ORIGINS: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().default("festiqo-api"),
    JWT_AUDIENCE: z.string().default("festiqo-web"),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(86400)
      .max(7776000)
      .default(2592000),
    COOKIE_DOMAIN: optionalString,
    SMTP_HOST: optionalString,
    SMTP_PORT: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().int().min(1).max(65535).optional(),
    ),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    EMAIL_FROM: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.email().optional(),
    ),
    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("lax"),
    CLOUDINARY_CLOUD_NAME: trimmedOptionalString,
    CLOUDINARY_API_KEY: trimmedOptionalString,
    CLOUDINARY_API_SECRET: trimmedOptionalString,
    CLOUDINARY_EVENT_FOLDER: trimmedOptionalString,
  })
  .refine(
    (value) => value.JWT_ACCESS_SECRET !== value.JWT_REFRESH_SECRET,
    "JWT secrets must be different",
  )
  .refine(
    (value) => value.COOKIE_SAME_SITE !== "none" || value.COOKIE_SECURE,
    "SameSite=None requires Secure cookies",
  )
  .refine((value) => {
    const smtp = [
      value.SMTP_HOST,
      value.SMTP_PORT,
      value.SMTP_USER,
      value.SMTP_PASSWORD,
      value.EMAIL_FROM,
    ];
    return !smtp.some(Boolean) || smtp.every(Boolean);
  }, "SMTP_HOST requires SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and EMAIL_FROM")
  .refine((value) => {
    const cloudinary = [
      value.CLOUDINARY_CLOUD_NAME,
      value.CLOUDINARY_API_KEY,
      value.CLOUDINARY_API_SECRET,
    ];
    return !cloudinary.some(Boolean) || cloudinary.every(Boolean);
  }, "Event image uploads require CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET")
  .refine((value) => {
    const urls = [
      value.FRONTEND_URL,
      ...(value.CORS_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ];
    return urls.every((origin) => {
      const url = new URL(origin);
      return url.pathname === "/" && !url.search && !url.hash;
    });
  }, "Frontend and CORS settings must contain only web origins");

export const env = schema.parse(process.env);

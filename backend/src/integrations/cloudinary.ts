import { createHash } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { fail } from "../common/errors/app-error.js";

export type UploadedImage = { url: string; publicId: string };

export const cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME!,
    api_key: env.CLOUDINARY_API_KEY!,
    api_secret: env.CLOUDINARY_API_SECRET!,
  });
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Uploads an event poster to Cloudinary and returns its secure URL plus the
 * public id needed to replace or delete the asset later.
 */
export async function uploadEventImage(file: Express.Multer.File): Promise<UploadedImage> {
  if (!cloudinaryConfigured)
    return fail(503, "CLOUDINARY_NOT_CONFIGURED", "Image uploads are not configured");
  if (!ALLOWED_MIME_TYPES.has(file.mimetype))
    return fail(415, "UNSUPPORTED_IMAGE_TYPE", "Use a JPG, PNG, or WebP image");
  if (file.size > MAX_IMAGE_BYTES)
    return fail(413, "IMAGE_TOO_LARGE", "Event images must be 5 MB or smaller");

  const checksum = createHash("sha256").update(file.buffer).digest("base64");
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: env.CLOUDINARY_EVENT_FOLDER,
          resource_type: "image",
          overwrite: false,
          unique_filename: true,
          use_filename: true,
          filename_override: file.originalname.replace(/\.[^.]*$/, "") || "event-image",
          tags: ["festiqo-event-image"],
          access_control: [{ access_mode: "public", types: ["upload"] }],
          headers: { "X-File-Checksum": checksum },
        },
        (error, result) => {
          if (error || !result?.secure_url || !result?.public_id) {
            logger.error({ error }, "Cloudinary upload failed");
            reject(new Error("Could not upload the event image"));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      )
      .end(file.buffer);
  });
}

/**
 * Best-effort removal of a stored asset. Missing assets are treated as deleted
 * so cleanup flows stay idempotent.
 */
export async function deleteEventImage(publicId: string): Promise<boolean> {
  if (!publicId) return true;
  if (!cloudinaryConfigured) {
    logger.warn({ publicId }, "Cloudinary is not configured; skipping image deletion");
    return false;
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result === "ok" || result.result === "not_found") return true;
    logger.warn({ publicId, result }, "Cloudinary did not confirm image deletion");
    return false;
  } catch (error) {
    logger.error({ error, publicId }, "Cloudinary image deletion failed");
    return false;
  }
}

/** Derives the Cloudinary public id stored on an event document (or a raw URL). */
export function publicIdFromStoredImage(stored: unknown): string {
  if (typeof stored !== "string" || !stored) return "";
  if (!stored.startsWith("http")) return stored;
  try {
    const url = new URL(stored);
    const marker = "/upload/";
    const index = url.pathname.indexOf(marker);
    if (index === -1) return "";
    const afterVersion = url.pathname
      .slice(index + marker.length)
      .replace(/^v\d+\//, "");
    return afterVersion.replace(/\.[^./]+$/, "");
  } catch {
    return "";
  }
}

import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError, fail } from "../common/errors/app-error.js";

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
/** Fail fast if Cloudinary's API is unreachable (offline PC, firewall, proxy). */
const CLOUDINARY_TIMEOUT_MS = 8000;

/** Folder for event posters; falls back to the app default when unset. */
const eventImageFolder = () => env.CLOUDINARY_EVENT_FOLDER || "festiqo/events";

/**
 * Uploads an event poster to Cloudinary and returns its secure URL plus the
 * public id needed to replace or delete the asset later.
 */
export async function uploadEventImage(file: Express.Multer.File): Promise<UploadedImage> {
  if (!file) return fail(400, "IMAGE_REQUIRED", "Select an image file to upload");
  // Validate the file itself before touching Cloudinary so misconfigured
  // servers still give the admin actionable feedback about the upload.
  if (!ALLOWED_MIME_TYPES.has(file.mimetype))
    return fail(415, "UNSUPPORTED_IMAGE_TYPE", "Use a JPG, PNG, or WebP image");
  if (file.size > MAX_IMAGE_BYTES)
    return fail(413, "IMAGE_TOO_LARGE", "Event images must be 5 MB or smaller");
  if (!cloudinaryConfigured)
    return fail(503, "CLOUDINARY_NOT_CONFIGURED", "Image uploads are not configured");

  return new Promise<UploadedImage>((resolve, reject) => {
    // Fail fast with a clear message instead of letting the SDK block until its
    // 60-second timeout when the host cannot reach api.cloudinary.com.
    let settled = false;
    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      settled = true;
      logger.error(
        { timeoutMs: CLOUDINARY_TIMEOUT_MS, cloudName: env.CLOUDINARY_CLOUD_NAME },
        "Cloudinary upload timed out (network unreachable?)",
      );
      reject(
        new AppError(
          504,
          "IMAGE_UPLOAD_TIMEOUT",
          "Could not reach Cloudinary. Check this machine's internet connection or proxy settings.",
        ),
      );
    }, CLOUDINARY_TIMEOUT_MS);
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      fn();
    };
    cloudinary.uploader
      .upload_stream(
        {
          folder: eventImageFolder(),
          resource_type: "image",
          overwrite: false,
          unique_filename: true,
          use_filename: true,
          filename_override: file.originalname.replace(/\.[^.]*$/, "") || "event-image",
          tags: ["festiqo-event-image"],
          // NOTE: do not add `access_control` here — the upload API rejects it
          // ("Access control invalid property: access_mode"). Uploaded assets are
          // public by default. Likewise, custom `headers` (e.g. an
          // "X-File-Checksum") are rejected with "Unsupported Custom Header".
        },
        (error, result) => {
          if (error || !result?.secure_url || !result?.public_id) {
            // Log the real cause (auth failure, bad folder, network, etc.) so
            // ops can diagnose, but only surface a safe AppError to the client.
            logger.error(
              {
                error: error
                  ? { name: error.name, message: error.message, http_code: error.http_code }
                  : undefined,
                result,
              },
              "Cloudinary upload failed",
            );
            settle(() =>
              reject(
                new AppError(
                  502,
                  "IMAGE_UPLOAD_FAILED",
                  "Could not upload the event image. Check CLOUDINARY_* settings and the server logs for details.",
                ),
              ),
            );
            return;
          }
          settle(() => resolve({ url: result.secure_url, publicId: result.public_id }));
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

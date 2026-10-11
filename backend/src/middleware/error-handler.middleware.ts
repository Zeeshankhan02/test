import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { MulterError } from "multer";
import { logger } from "../config/logger.js";
import { AppError } from "../common/errors/app-error.js";

export const errorHandlerMiddleware: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  _next,
) => {
  const requestId = res.getHeader("X-Request-Id");
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: "Invalid request data",
      error: {
        code: "VALIDATION_ERROR",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      requestId,
    });
  }
  if (error instanceof AppError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      error: { code: error.code },
      requestId,
    });
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      error: { code: "UNAUTHORIZED" },
      requestId,
    });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return res.status(403).json({
      success: false,
      message: "Insufficient permissions",
      error: { code: "FORBIDDEN" },
      requestId,
    });
  }
  if (error && typeof error === "object" && "code" in error && error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A conflicting record already exists",
      error: { code: "CONFLICT" },
      requestId,
    });
  }
  // Malformed JSON request body (tagged by the JSON body parser wrapper).
  const err = error as { type?: string; status?: number; message?: string } | null;
  if (err?.type === "entity.parse.failed" || err?.status === 400) {
    return res.status(400).json({
      success: false,
      message: "Request body must be valid JSON",
      error: { code: "BAD_JSON" },
      requestId,
    });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body too large",
      error: { code: "PAYLOAD_TOO_LARGE" },
      requestId,
    });
  }
  if (err?.status === 415 || err?.type === "entity.unsupported.mediatype") {
    return res.status(415).json({
      success: false,
      message: "Unsupported media type",
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
      requestId,
    });
  }
  if (error instanceof MulterError) {
    return res.status(400).json({
      success: false,
      message: `File upload failed: ${error.message}`,
      error: { code: error.code },
      requestId,
    });
  }
  logger.error(
    {
      requestId,
      method: req.method,
      path: req.path,
      errorType: error instanceof Error ? error.name : "unknown",
    },
    "Unhandled request error",
  );
  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: { code: "INTERNAL_ERROR" },
    requestId,
  });
};

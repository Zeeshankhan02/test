import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { MulterError } from "multer";
import mongoose from "mongoose";
import { logger } from "../config/logger.js";
import { AppError } from "../common/errors/app-error.js";
import { databaseReady } from "../config/database.js";

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
  // Mongoose errors are operational database failures, not bugs in the
  // request pipeline. Translate them into 5xx responses so they never fall
  // through as an unhandled "MongooseError" log with a generic 500.
  if (error instanceof mongoose.Error || error instanceof mongoose.MongooseError) {
    const name = error?.name;
    const isValidation = name === "ValidationError";
    const isCast = name === "CastError";
    // Buffering-timeout and server-selection failures are pure connectivity
    // problems: the operation was never sent to MongoDB. Treat them as
    // "database unavailable" (503) even when the connection briefly flaps
    // back to "connected" (readyState 1) between the failure and this log —
    // otherwise a transient blip gets misclassified as a 502 DATABASE_ERROR.
    const message = typeof error.message === "string" ? error.message : "";
    const isConnectivity =
      name === "MongooseServerSelectionError" ||
      name === "MongooseError" &&
        /buffering timed out|Connection is disconnected|was force closed/i.test(message);
    const dbUp = databaseReady();
    if (!dbUp || isConnectivity) {
     logger.warn(
  {
    requestId,
    method: req.method,
    path: req.path,
    errorType: name,
    errorMessage: error.message,
    readyState: mongoose.connection.readyState,
    database: mongoose.connection.name,
  },
  "Database unavailable while handling request",
);
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable",
        error: { code: "DATABASE_UNAVAILABLE" },
        requestId,
      });
    }
    if (isValidation || isCast) {
      return res.status(400).json({
        success: false,
        message: isCast ? "Invalid identifier format" : "Invalid request data",
        error: { code: isCast ? "INVALID_ID" : "VALIDATION_ERROR" },
        requestId,
      });
    }
    logger.error(
      {
        requestId,
        method: req.method,
        path: req.path,
        errorType: name,
      },
      "Database request error",
    );
    return res.status(502).json({
      success: false,
      message: "Database request failed",
      error: { code: "DATABASE_ERROR" },
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

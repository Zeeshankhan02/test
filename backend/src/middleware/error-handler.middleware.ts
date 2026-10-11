import type { ErrorRequestHandler } from "express";
import { z } from "zod";
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

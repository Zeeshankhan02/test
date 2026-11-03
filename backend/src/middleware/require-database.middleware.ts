import type { RequestHandler } from "express";
import { databaseReady } from "../config/database.js";

/**
 * Fail-fast guard for serverless / cold-start scenarios.
 *
 * Without it, any DB query that arrives before `connectDatabase()` has
 * completed gets queued by Mongoose and dies ~10s later with
 * "Operation `users.findOne()` buffering timed out after 10000ms" — burning
 * the function's execution budget and returning an opaque error. With
 * buffering disabled (see config/database.ts) plus this middleware, requests
 * that have already proven a DB round-trip is required (they carry
 * credentials) are answered immediately with a clear 503 DATABASE_UNAVAILABLE
 * so the client can retry once the instance is warm. Unauthenticated requests
 * fall through so `authenticate` can still return the proper 401/403 without
 * touching the database.
 */
export const requireDatabaseMiddleware: RequestHandler = (req, res, next) => {
  if (databaseReady()) return next();
  const unauthorized = !req.headers.authorization && !req.headers.cookie;
  if (unauthorized) return next();
  return res.status(503).json({
    success: false,
    message: "Service temporarily unavailable",
    error: { code: "DATABASE_UNAVAILABLE" },
    requestId: res.getHeader("X-Request-Id"),
  });
};

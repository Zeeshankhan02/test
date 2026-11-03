import type { RequestHandler } from "express";
import { databaseReady } from "../config/database.js";

/**
 * Fail-fast guard for requests that arrive while MongoDB is unreachable.
 *
 * On a long-running server this normally never triggers, because `server.ts`
 * connects before `listen()` (and crashes fast if it can't). It exists as a
 * safety net: if the connection drops or was never established (e.g. the DB
 * process restarted, or the app was started in a mode that skipped startup
 * connect), queries would otherwise sit in Mongoose's buffer and die ~10s
 * later with "Operation `users.findOne()` buffering timed out after 10000ms".
 * Requests that have already proven a DB round-trip is required (they carry
 * credentials) are answered immediately with a clear 503 DATABASE_UNAVAILABLE
 * so the client can retry once the connection recovers. Unauthenticated
 * requests fall through so `authenticate` can still return the proper
 * 401/403 without touching the database.
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

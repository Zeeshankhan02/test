import type { RequestHandler } from "express";
import { AppError } from "../common/errors/app-error.js";
import { allowedOrigins } from "../config/cors.js";

const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const cookieCsrfMiddleware: RequestHandler = (req, _res, next) => {
  if (
    req.cookies.refreshToken &&
    stateChangingMethods.has(req.method) &&
    (!req.get("origin") || !allowedOrigins.has(req.get("origin")!))
  ) {
    return next(
      new AppError(403, "CSRF_ORIGIN_REJECTED", "Request origin is not allowed"),
    );
  }
  return next();
};

import type { RequestHandler } from "express";
import { AppError } from "../common/errors/app-error.js";

export const notFoundMiddleware: RequestHandler = (_req, _res, next) =>
  next(new AppError(404, "NOT_FOUND", "Route not found"));

import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";

export const requestIdMiddleware: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Request-Id", randomBytes(12).toString("hex"));
  next();
};

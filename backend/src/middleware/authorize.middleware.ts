import type { RequestHandler } from "express";
import type { Principal } from "./authenticate.middleware.js";

export const allow =
  (...roles: Principal["role"][]): RequestHandler =>
  (req, _res, next) => {
    if (!req.principal) return next(new Error("UNAUTHORIZED"));
    if (!roles.includes(req.principal.role)) {
      return next(new Error("FORBIDDEN"));
    }
    next();
  };

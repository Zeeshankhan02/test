import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { fail } from "../common/errors/app-error.js";
import { User } from "../modules/models.js";
import { AppError } from "../common/errors/app-error.js";

export type Principal = {
  id: string;
  role: "student" | "volunteer" | "admin";
  name: string;
  email: string;
  tokenVersion: number;
};

declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : "";
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    if (
      typeof payload === "string" ||
      !payload.sub ||
      !Number.isInteger(payload.ver) ||
      !["student", "volunteer", "admin"].includes(String(payload.role))
    ) {
      return fail(401, "UNAUTHORIZED", "Authentication required");
    }
    void User.findById(payload.sub)
      .select("_id role name email active +tokenVersion")
      .lean()
      .then((user) => {
        if (!user?.active || user.tokenVersion !== payload.ver) {
          return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
        }
        req.principal = {
          id: String(user._id),
          role: user.role as Principal["role"],
          name: user.name,
          email: user.email,
          tokenVersion: user.tokenVersion,
        };
        return next();
      })
      .catch(next);
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
};

import cors from "cors";
import { env } from "./env.js";
import { AppError } from "../common/errors/app-error.js";

export const allowedOrigins = new Set([
  env.FRONTEND_URL,
  ...(env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new AppError(403, "CORS_ORIGIN_REJECTED", "Origin is not allowed"));
  },
  credentials: true,
});

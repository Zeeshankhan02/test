import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";

export const securityMiddleware = [
  helmet(),
  express.json({ limit: "100kb" }),
  cookieParser(),
];

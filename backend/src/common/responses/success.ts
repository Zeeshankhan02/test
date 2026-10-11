import type { Response } from "express";

export const success = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

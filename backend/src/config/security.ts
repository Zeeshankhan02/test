import express from "express";
import * as helmet from "helmet";
import cookieParser from "cookie-parser";

/**
 * `express.json` throws a raw SyntaxError when the body is not valid JSON. By
 * default that error carries no status/type, so it slips through the error
 * handler's typed branches and surfaces as an opaque 500 ("Unhandled request
 * error"). Tagging it with type "entity.parse.failed" + status 400 lets the
 * client receive a proper 400 BAD_JSON instead.
 */
const jsonBodyParser = express.json({ limit: "100kb" });
const parseJsonBody: express.RequestHandler = (req, res, next) =>
  jsonBodyParser(req, res, (error?: unknown) => {
    if (error instanceof SyntaxError) {
      return next(Object.assign(error, { type: "entity.parse.failed", status: 400 }));
    }
    return next(error);
  });

export const securityMiddleware = [helmet.default(), parseJsonBody, cookieParser()];

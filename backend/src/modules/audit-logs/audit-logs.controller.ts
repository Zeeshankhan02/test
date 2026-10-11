import type { RequestHandler } from "express";
import { asyncRoute } from "../../common/utils/async-route.js";
import { parseBody } from "../../common/validators/object-id.js";
import { getAuditLogs } from "./audit-logs.service.js";
import { auditLogQuery } from "./audit-logs.validator.js";

export const listAuditLogs: RequestHandler = asyncRoute(async (req, res) => {
  const query = parseBody(auditLogQuery, req.query);
  const result = await getAuditLogs(query.page, query.limit, query.action);
  return res.json({ success: true, ...result });
});

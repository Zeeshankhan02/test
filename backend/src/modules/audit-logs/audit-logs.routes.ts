import { Router } from "express";
import { listAuditLogs } from "./audit-logs.controller.js";
import { allow } from "../../middleware/authorize.middleware.js";

export const auditLogsRoutes = Router();
auditLogsRoutes.get("/admin/audit-logs", allow("admin"), listAuditLogs);

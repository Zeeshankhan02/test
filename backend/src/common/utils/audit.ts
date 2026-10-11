import { AuditLog } from "../../modules/models.js";

export function recordAudit(
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, string | number | boolean> = {},
) {
  return AuditLog.create({ actorId, action, resourceType, resourceId, metadata });
}

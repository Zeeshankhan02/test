import { AuditLog } from "../models.js";

export async function getAuditLogs(page: number, limit: number, action?: string) {
  const filter = action ? { action } : {};
  const [data, total] = await Promise.all([
    AuditLog.find(filter)
      .select("actorId action resourceType resourceId metadata createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

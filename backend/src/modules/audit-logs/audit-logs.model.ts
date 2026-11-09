import mongoose, { Schema } from "mongoose";
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, maxlength: 100 },
    resourceType: { type: String, required: true, maxlength: 100 },
    resourceId: { type: String, required: true, maxlength: 100 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, strict: "throw" },
);
auditLogSchema.index({ createdAt: -1, action: 1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);

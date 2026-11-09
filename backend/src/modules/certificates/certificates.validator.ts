import { z } from "zod";
import { objectId } from "../../common/validators/object-id.js";

export const certificateTemplateInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(1000),
  eventId: objectId,
  certificateType: z.enum(["participation", "winner"]).default("participation"),
  signatureName: z.string().min(1).max(100),
  signatureRole: z.string().min(1).max(100),
  logoUrl: z.string().url().max(2048).optional().or(z.literal("")),
  signatureImageUrl: z.string().url().max(2048).optional().or(z.literal("")),
});

export const publishCertificateInput = z.object({ templateId: objectId });
export const generateEventCertificatesInput = z.object({
  templateId: objectId,
  certificateType: z.enum(["participation", "winner"]),
  competitionId: objectId.optional(),
});
export const publishEventCertificatesInput = z.object({
  certificateType: z.enum(["participation", "winner"]),
  competitionId: objectId.optional(),
});
export const certificateTemplateUpdateInput = certificateTemplateInput.partial();
export const certificateIdentifier = z.string().min(1).max(64);

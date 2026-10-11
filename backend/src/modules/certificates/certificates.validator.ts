import { z } from "zod";
import { objectId } from "../../common/validators/object-id.js";

export const certificateTemplateInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(1000),
  eventId: objectId,
  signatureName: z.string().min(1).max(100),
  signatureRole: z.string().min(1).max(100),
});

export const publishCertificateInput = z.object({ templateId: objectId });
export const certificateTemplateUpdateInput = certificateTemplateInput.partial();
export const certificateIdentifier = z.string().min(1).max(64);

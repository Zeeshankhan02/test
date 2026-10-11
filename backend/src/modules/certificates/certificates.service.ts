import { randomBytes } from "node:crypto";
import { fail } from "../../common/errors/app-error.js";
import { recordAudit } from "../../common/utils/audit.js";
import { emitUserNotification } from "../../sockets/socket-server.js";
import type { z } from "zod";
import {
  Certificate,
  CertificateTemplate,
  Notification,
  Registration,
  User,
} from "../models.js";
import type {
  certificateTemplateInput,
  certificateTemplateUpdateInput,
} from "./certificates.validator.js";

type TemplateInput = z.infer<typeof certificateTemplateInput>;

export async function getTemplates() {
  return CertificateTemplate.find().sort({ createdAt: -1 }).lean();
}

export async function addTemplate(adminId: string, input: TemplateInput) {
  const template = await CertificateTemplate.create(input);
  await recordAudit(
    adminId,
    "certificate_template.created",
    "certificate_template",
    String(template._id),
  );
  return template;
}

export async function editTemplate(
  adminId: string,
  templateId: string,
  input: z.input<typeof certificateTemplateUpdateInput>,
) {
  const template = await CertificateTemplate.findOneAndUpdate(
    { _id: templateId, status: "draft" },
    { $set: input },
    { new: true, runValidators: true },
  );
  if (!template) return fail(404, "NOT_FOUND", "Draft template not found");
  await recordAudit(
    adminId,
    "certificate_template.updated",
    "certificate_template",
    String(template._id),
  );
  return template;
}

export async function issueCertificates(adminId: string, templateId: string) {
  const template = await CertificateTemplate.findById(templateId);
  if (!template) return fail(404, "NOT_FOUND", "Certificate template not found");
  const eligible = await Registration.find({
    eventId: template.eventId,
    status: "confirmed",
  })
    .select("_id userId teamName")
    .lean();
  if (eligible.length > 25_000)
    return fail(
      503,
      "AUDIENCE_TOO_LARGE",
      "Certificate batch exceeds synchronous publishing limits",
    );
  const users = await User.find({ _id: { $in: eligible.map((row) => row.userId) } })
    .select("_id name")
    .lean();
  const names = new Map(users.map((user) => [String(user._id), user.name]));
  const session = await Certificate.startSession();
  let created = 0;
  const notificationIds: string[] = [];
  try {
    await session.withTransaction(async () => {
      created = 0;
      notificationIds.length = 0;
      for (const registration of eligible) {
        const accountName = names.get(String(registration.userId));
        const recipientName = registration.teamName || accountName;
        if (!accountName || !recipientName)
          return fail(
            409,
            "CERTIFICATE_RECIPIENT_MISSING",
            "A registered participant account is missing",
          );
        const certificateId = `FQ-${randomBytes(9).toString("hex").toUpperCase()}`;
        const result = await Certificate.updateOne(
          { templateId, registrationId: registration._id },
          {
            $setOnInsert: {
              templateId,
              registrationId: registration._id,
              userId: registration.userId,
              recipientName,
              certificateId,
            },
          },
          { upsert: true, session },
        );
        created += result.upsertedCount;
        if (result.upsertedCount) {
          const [notification] = await Notification.create(
            [
              {
                userId: registration.userId,
                type: "event",
                title: "Your certificate is ready",
                message: `A certificate for ${template.description} is now available.`,
              },
            ],
            { session },
          );
          notificationIds.push(String(notification!._id));
        }
      }
      template.status = "published";
      await template.save({ session });
    });
  } finally {
    await session.endSession();
  }
  const notifications = await Notification.find({
    _id: { $in: notificationIds },
  }).lean();
  notifications.forEach((notification) =>
    emitUserNotification(String(notification.userId), notification),
  );
  await recordAudit(
    adminId,
    "certificates.published",
    "certificate_template",
    String(template._id),
    { issuedCount: created },
  );
  return { published: created };
}

export async function listUserCertificates(userId: string) {
  return Certificate.find({ userId, revokedAt: { $exists: false } })
    .populate("templateId", "title description eventId signatureName signatureRole")
    .lean();
}

export async function revokeIssuedCertificate(adminId: string, certificateId: string) {
  const certificate = await Certificate.findOneAndUpdate(
    { certificateId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
    { new: true },
  );
  if (!certificate) return fail(404, "NOT_FOUND", "Active certificate not found");
  await recordAudit(
    adminId,
    "certificate.revoked",
    "certificate",
    certificate.certificateId,
  );
  return { certificateId: certificate.certificateId, revokedAt: certificate.revokedAt };
}

export async function verifyIssuedCertificate(certificateId: string) {
  const certificate = await Certificate.findOne({ certificateId })
    .populate("templateId", "title eventId")
    .lean();
  if (!certificate) return fail(404, "NOT_FOUND", "Certificate not found");
  if (certificate.revokedAt)
    return fail(410, "CERTIFICATE_REVOKED", "Certificate is no longer valid");
  return {
    certificateId: certificate.certificateId,
    issuedAt: certificate.issuedAt,
    template: certificate.templateId,
  };
}

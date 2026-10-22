import { randomBytes } from "node:crypto";
import { fail } from "../../common/errors/app-error.js";
import { recordAudit } from "../../common/utils/audit.js";
import { emitUserNotification } from "../../sockets/socket-server.js";
import type { z } from "zod";
import {
  Certificate,
  CertificateTemplate,
  Event,
  FestConfig,
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

/**
 * Render a real PDF for an issued, non-revoked certificate owned by the
 * requesting student. Ownership + publication are verified on the trusted
 * backend before any bytes are produced; revoked or foreign certificates
 * simply 404/410 so guessing an id cannot leak another student's file.
 */
export async function renderCertificatePdf(userId: string, certificateDocId: string) {
  const certificate = await Certificate.findById(certificateDocId)
    .populate("templateId")
    .lean();
  if (!certificate) return fail(404, "NOT_FOUND", "Certificate not found");
  if (String((certificate as { userId?: unknown }).userId) !== userId)
    return fail(
      403,
      "CERTIFICATE_FORBIDDEN",
      "This certificate belongs to another participant",
    );
  if ((certificate as { revokedAt?: Date }).revokedAt)
    return fail(410, "CERTIFICATE_REVOKED", "This certificate has been revoked");
  const template = certificate.templateId as unknown as {
    title?: string;
    description?: string;
    status?: string;
    signatureName?: string;
    signatureRole?: string;
    eventId?: string;
  };
  if (!template || template.status !== "published")
    return fail(
      403,
      "CERTIFICATE_UNPUBLISHED",
      "This certificate is not published yet",
    );
  const event = await Event.findById(template.eventId).select("title").lean();
  const fest = await FestConfig.findOne({ key: "current" }).lean();
  const recipient = String(
    (certificate as { recipientName?: string }).recipientName || "",
  );
  const issuedAt = (certificate as { issuedAt?: Date | string }).issuedAt;

  // jspdf resolves to its Node build under the node condition (tsconfig moduleResolution: node).
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(2);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  doc.setTextColor(251, 191, 36);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text((fest?.title || "College Fest").toUpperCase(), pageWidth / 2, 30, {
    align: "center",
  });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(30);
  doc.text("CERTIFICATE OF PARTICIPATION", pageWidth / 2, 48, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("This certificate is proudly presented to", pageWidth / 2, 66, {
    align: "center",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(217, 119, 6);
  doc.text(recipient, pageWidth / 2, 82, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(226, 232, 240);
  const eventName = (event?.title || "").trim();
  doc.text(
    `for participating in ${eventName ? `"${eventName}"` : "the fest quiz"} — ${template.title}`,
    pageWidth / 2,
    95,
    { align: "center", maxWidth: pageWidth - 40 },
  );
  if (template.description)
    doc.text(template.description, pageWidth / 2, 108, {
      align: "center",
      maxWidth: pageWidth - 60,
    });

  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184);
  const issuedText = issuedAt
    ? new Date(issuedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  doc.text(
    `Issued ${issuedText}   •   ID: ${(certificate as { certificateId?: string }).certificateId}`,
    pageWidth / 2,
    pageHeight - 42,
    { align: "center" },
  );

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(template.signatureName || "", pageWidth / 2, pageHeight - 26, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(template.signatureRole || "", pageWidth / 2, pageHeight - 20, {
    align: "center",
  });

  const filenameParts = [eventName || "certificate", recipient]
    .join("-")
    // Strip path separators, ASCII control characters and non-printables.
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
  return {
    buffer: Buffer.from(doc.output("arraybuffer")),
    filename: `${filenameParts || "certificate"}.pdf`,
  };
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

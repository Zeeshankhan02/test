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
  Quiz,
  Ticket,
} from "../models.js";
import type {
  certificateTemplateInput,
  certificateTemplateUpdateInput,
} from "./certificates.validator.js";

type TemplateInput = z.infer<typeof certificateTemplateInput>;

async function eligibleParticipationRegistrations(eventId: string) {
  const registrations = await Registration.find({ eventId, status: "confirmed" })
    .select("_id userId memberIds teamName")
    .lean();
  const checkedIn = new Set((await Ticket.distinct("registrationId", {
    registrationId: { $in: registrations.map((row) => row._id) },
    status: "checked_in",
  })).map(String));
  return registrations.filter((row) => checkedIn.has(String(row._id)));
}

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
  if (await Certificate.exists({ templateId }))
    return fail(409, "CERTIFICATES_ALREADY_GENERATED", "A certificate template cannot be changed after certificates have been generated");
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

export async function generateEventCertificates(
  adminId: string,
  eventId: string,
  input: { templateId: string; certificateType: "participation" | "winner"; competitionId?: string | undefined },
) {
  const template = await CertificateTemplate.findById(input.templateId);
  if (!template || String(template.eventId) !== eventId)
    return fail(404, "NOT_FOUND", "Certificate template not found for this event");
  if ((template.certificateType ?? "participation") !== input.certificateType)
    return fail(400, "CERTIFICATE_TYPE_MISMATCH", "Choose a template for this certificate category");
  const event = await Event.findById(eventId).select("status endsAt").lean();
  if (!event) return fail(404, "NOT_FOUND", "Event not found");
  if (event.endsAt > new Date()) return fail(409, "EVENT_NOT_COMPLETED", "Wait until the event has ended before generating certificates");
  let competitionId: string | undefined;
  let rankRows: { userId: string; rank: number }[] = [];
  if (input.certificateType === "winner") {
    if (!input.competitionId) return fail(400, "COMPETITION_REQUIRED", "Choose a final-round competition");
    const quiz = await Quiz.findOne({ _id: input.competitionId, eventId }).select("round3PublishedAt round3Rankings").lean();
    if (!quiz?.round3PublishedAt) return fail(409, "FINAL_RESULTS_NOT_PUBLISHED", "Publish final-round results before generating winner certificates");
    rankRows = (quiz.round3Rankings as { userId: string; rank: number }[]).filter((row) => row.rank >= 1 && row.rank <= 3);
    if (!rankRows.length || new Set(rankRows.map((row) => row.rank)).size !== rankRows.length || new Set(rankRows.map((row) => row.userId)).size !== rankRows.length)
      return fail(409, "FINAL_RANKINGS_INVALID", "Final results must contain unique participants in the top three positions");
    competitionId = input.competitionId;
  } else if (input.competitionId) return fail(400, "INVALID_CERTIFICATE_TYPE", "Participation certificates do not use competition results");
  const registrations = input.certificateType === "participation"
    ? await eligibleParticipationRegistrations(eventId)
    : await Registration.find({ eventId, status: "confirmed", $or: [{ userId: { $in: rankRows.map((row) => row.userId) } }, { memberIds: { $in: rankRows.map((row) => row.userId) } }] }).select("_id userId memberIds teamName").lean();
  const checkedIn = registrations;
  const userIds = input.certificateType === "participation" ? checkedIn.map((row) => row.userId) : rankRows.map((row) => row.userId);
  const users = await User.find({ _id: { $in: userIds } }).select("_id name").lean();
  const names = new Map(users.map((user) => [String(user._id), user.name]));
  const targets = input.certificateType === "participation"
    ? checkedIn.map((registration) => ({ registration, userId: String(registration.userId), rank: undefined as number | undefined }))
    : rankRows.map((rankRow) => {
        const matches = registrations.filter((registration) => String(registration.userId) === rankRow.userId || registration.memberIds?.some((id) => String(id) === rankRow.userId));
        if (matches.length !== 1) return fail(409, "WINNER_REGISTRATION_MISSING", "Every finalist must have exactly one active event registration");
        return { registration: matches[0]!, userId: rankRow.userId, rank: rankRow.rank };
      });
  if (!targets.length) return fail(409, "NO_ELIGIBLE_PARTICIPANTS", input.certificateType === "participation" ? "No checked-in participants are eligible" : "No top-three finalists are eligible");
  if (targets.some((target) => !target.registration.teamName && !names.get(target.userId)))
    return fail(409, "CERTIFICATE_RECIPIENT_MISSING", "A certificate recipient account is missing");
  if (new Set(targets.map((target) => String(target.registration._id))).size !== targets.length)
    return fail(409, "FINAL_RANKINGS_AMBIGUOUS", "One registration cannot receive multiple places in the final round");
  if (targets.length > 25_000)
    return fail(
      503,
      "AUDIENCE_TOO_LARGE",
      "Certificate batch exceeds synchronous publishing limits",
    );
  const session = await Certificate.startSession();
  let created = 0;
  try {
    await session.withTransaction(async () => {
      created = 0;
      for (const target of targets) {
        const registration = target.registration;
        const accountName = names.get(target.userId);
        const recipientName = registration.teamName || accountName;
        if ((!accountName && !registration.teamName) || !recipientName)
          return fail(
            409,
            "CERTIFICATE_RECIPIENT_MISSING",
            "A registered participant account is missing",
          );
        const existingCertificate = await Certificate.findOne({
          eventId,
          registrationId: registration._id,
          awardType: input.certificateType,
          ...(competitionId ? { competitionId } : { competitionId: { $exists: false } }),
          staleAt: { $exists: false },
          revokedAt: { $exists: false },
        }).session(session).select("templateId").lean();
        if (existingCertificate && String(existingCertificate.templateId) !== input.templateId)
          return fail(409, "CERTIFICATE_ALREADY_EXISTS", "A certificate for this recipient and category already exists for the event");
        const certificateId = `FQ-${randomBytes(9).toString("hex").toUpperCase()}`;
        const result = await Certificate.updateOne(
          { eventId, registrationId: registration._id, awardType: input.certificateType, ...(competitionId ? { competitionId } : { competitionId: { $exists: false } }), staleAt: { $exists: false }, revokedAt: { $exists: false } },
          {
            $setOnInsert: {
              templateId: input.templateId,
              registrationId: registration._id,
              userId: registration.userId,
              eventId,
              recipientName,
              certificateId,
              awardType: input.certificateType,
              ...(competitionId ? { competitionId } : {}),
              ...(target.rank ? { rank: target.rank } : {}),
            },
          },
          { upsert: true, session },
        );
        created += result.upsertedCount;
      }
    });
  } finally {
    await session.endSession();
  }
  await recordAudit(adminId, "certificates.generated", "event", eventId, { certificateType: input.certificateType, ...(competitionId ? { competitionId } : {}), generated: created });
  return { generated: created, total: targets.length };
}

export async function issueCertificates(adminId: string, templateId: string) {
  const template = await CertificateTemplate.findById(templateId).select("eventId certificateType").lean();
  if (!template) return fail(404, "NOT_FOUND", "Certificate template not found");
  await generateEventCertificates(adminId, String(template.eventId), {
    templateId,
    certificateType: template.certificateType ?? "participation",
  });
  return publishEventCertificates(adminId, String(template.eventId), template.certificateType ?? "participation");
}

export async function publishEventCertificates(
  adminId: string,
  eventId: string,
  certificateType: "participation" | "winner",
  competitionId?: string | undefined,
) {
  const filter = {
    eventId,
    awardType: certificateType,
    staleAt: { $exists: false },
    revokedAt: { $exists: false },
    publishedAt: { $exists: false },
    ...(competitionId ? { competitionId } : {}),
  };
  const certificates = await Certificate.find(filter).select("_id registrationId rank").lean();
  if (!certificates.length) return fail(409, "NO_GENERATED_CERTIFICATES", "Generate eligible certificates before publishing");
  if (certificateType === "participation") {
    const eligible = await eligibleParticipationRegistrations(eventId);
    const eligibleIds = new Set(eligible.map((row) => String(row._id)));
    if (certificates.some((row) => !eligibleIds.has(String(row.registrationId))) || certificates.length !== eligible.length)
      return fail(409, "PARTICIPATION_CERTIFICATES_STALE", "Attendance eligibility changed. Regenerate certificates before publishing.");
  } else {
    if (!competitionId) return fail(400, "COMPETITION_REQUIRED", "Choose a final-round competition");
    const quiz = await Quiz.findOne({ _id: competitionId, eventId }).select("round3PublishedAt round3Rankings").lean();
    if (!quiz?.round3PublishedAt) return fail(409, "FINAL_RESULTS_NOT_PUBLISHED", "Publish final results before publishing winner certificates");
    const current = (quiz.round3Rankings as { userId: string; rank: number }[])
      .filter((row) => row.rank >= 1 && row.rank <= 3)
      .map((row) => row.userId + ":" + row.rank);
    const registrations = await Registration.find({ _id: { $in: certificates.map((row) => row.registrationId) } }).select("_id userId memberIds").lean();
    const generated = certificates.map((certificate) => {
      const registration = registrations.find((row) => String(row._id) === String(certificate.registrationId));
      const ids = registration ? [String(registration.userId), ...(registration.memberIds ?? []).map(String)] : [];
      return current.includes(ids.map((id) => id + ":" + certificate.rank).find((key) => current.includes(key)) || "");
    });
    if (generated.some((matches) => !matches) || certificates.length !== current.length)
      return fail(409, "WINNER_CERTIFICATES_STALE", "Final results changed after generation. Regenerate winner certificates before publishing.");
  }
  const now = new Date();
  await Certificate.updateMany(filter, { $set: { publishedAt: now } });
  const templateIds = [...new Set(await Certificate.distinct("templateId", { _id: { $in: certificates.map((row) => row._id) } }))];
  await CertificateTemplate.updateMany({ _id: { $in: templateIds } }, { $set: { status: "published" } });
  const registrations = await Registration.find({ _id: { $in: certificates.map((row) => row.registrationId) } }).select("userId memberIds").lean();
  const userIds = [...new Set(registrations.flatMap((row) => [String(row.userId), ...(row.memberIds ?? []).map(String)]))];
  const notifications = await Notification.insertMany(userIds.map((userId) => ({
    userId,
    type: "event",
    title: "Your certificate is ready",
    message: "An official certificate for this event is now available to view and download.",
  })));
  notifications.forEach((notification) => emitUserNotification(String(notification.userId), notification.toObject()));
  await recordAudit(adminId, "certificates.published", "event", eventId, { certificateType, ...(competitionId ? { competitionId } : {}), published: certificates.length });
  return { published: certificates.length, publishedAt: now };
}

export async function getEventCertificateStatus(eventId: string) {
  const event = await Event.findById(eventId).select("title status endsAt").lean();
  if (!event) return fail(404, "NOT_FOUND", "Event not found");
  const templates = await CertificateTemplate.find({ eventId }).select("_id").lean();
  const certificates = await Certificate.find({ templateId: { $in: templates.map((row) => row._id) } })
    .populate("templateId", "title description certificateType eventId signatureName signatureRole logoUrl signatureImageUrl status")
    .populate("registrationId", "teamName userId")
    .sort({ issuedAt: -1 })
    .lean();
  const attendance = await eligibleParticipationRegistrations(eventId);
  const publishedCompetitions = await Quiz.find({ eventId, round3PublishedAt: { $exists: true } }).select("round3Rankings").lean();
  const winners = publishedCompetitions.reduce((total, quiz) => total + (quiz.round3Rankings as { rank: number }[]).filter((row) => row.rank >= 1 && row.rank <= 3).length, 0);
  const isPublished = (row: (typeof certificates)[number]) => Boolean(row.publishedAt || (!row.eventId && (row.templateId as { status?: string } | null)?.status === "published"));
  const isStale = (row: (typeof certificates)[number]) => Boolean(row.staleAt || row.revokedAt);
  return {
    event: { id: eventId, title: event.title, status: event.status, endsAt: event.endsAt },
    eligibleParticipants: attendance.length,
    eligibleWinners: winners,
    generated: certificates.filter((row) => !isStale(row) && !isPublished(row)).length,
    published: certificates.filter((row) => !isStale(row) && isPublished(row)).length,
    certificates,
  };
}

export async function issueWinnerCertificate(adminId: string, quizId: string, sourceTemplateId: string) {
  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz?.winnerConfirmedAt || !quiz.winnerUserId || !quiz.round3PublishedAt)
    return fail(409, "WINNER_NOT_CONFIRMED", "Confirm the final-round winner before issuing a certificate");
  if (await Certificate.exists({ competitionId: quizId }))
    return fail(409, "WINNER_CERTIFICATE_EXISTS", "A winner certificate has already been issued");
  const source = await CertificateTemplate.findById(sourceTemplateId).lean();
  if (!source || String(source.eventId) !== String(quiz.eventId))
    return fail(400, "TEMPLATE_EVENT_MISMATCH", "Choose a certificate template for this quiz event");
  const registration = await Registration.findOne({
    eventId: quiz.eventId,
    userId: quiz.winnerUserId,
    status: "confirmed",
    $or: [{ teamName: { $exists: false } }, { teamName: "" }],
  }).lean();
  const user = await User.findById(quiz.winnerUserId).select("name").lean();
  if (!registration || !user)
    return fail(409, "WINNER_REGISTRATION_MISSING", "The winner needs an active individual event registration");
  const session = await Certificate.startSession();
  const result: { issued?: { _id: string; certificateId: string; userId: string } } = {};
  try {
    await session.withTransaction(async () => {
      if (await Certificate.exists({ competitionId: quizId }).session(session))
        return fail(409, "WINNER_CERTIFICATE_EXISTS", "A winner certificate has already been issued");
      const [template] = await CertificateTemplate.create([{
        title: `Winner Certificate · ${source.title}`,
        description: source.description,
        eventId: source.eventId,
        signatureName: source.signatureName,
        signatureRole: source.signatureRole,
        status: "published",
      }], { session });
      const certificateId = `FQ-${randomBytes(9).toString("hex").toUpperCase()}`;
      const [certificate] = await Certificate.create([{
        templateId: template!._id,
        registrationId: registration._id,
        userId: quiz.winnerUserId,
        recipientName: user.name,
        certificateId,
        awardType: "winner",
        competitionId: quiz._id,
      }], { session });
      result.issued = { certificateId: certificate!.certificateId, _id: String(certificate!._id), userId: String(quiz.winnerUserId) };
    });
  } finally {
    await session.endSession();
  }
  if (!result.issued) return fail(409, "CERTIFICATE_ISSUE_FAILED", "Winner certificate could not be issued");
  await recordAudit(adminId, "winner_certificate.published", "quiz", quizId, { certificateId: result.issued.certificateId, userId: result.issued.userId });
  return result.issued;
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
  const registration = await Registration.findOne({
    _id: certificate.registrationId,
    $or: [{ userId }, { memberIds: userId }],
  }).select("_id").lean();
  if (!registration)
    return fail(403, "CERTIFICATE_FORBIDDEN", "This certificate belongs to another participant");
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
  const legacyPublished = !(certificate as { eventId?: unknown }).eventId && template?.status === "published";
  if (!template || (!(certificate as { publishedAt?: Date }).publishedAt && !legacyPublished))
    return fail(
      403,
      "CERTIFICATE_UNPUBLISHED",
      "This certificate is not published yet",
    );
  const event = await Event.findById(template.eventId).select("title").lean();
  const fest = await FestConfig.findOne({ key: "current" })
    .select("title startsAt endsAt timezone")
    .lean();
  const recipient = String(
    (certificate as { recipientName?: string }).recipientName || "",
  );
  const issuedAt = (certificate as { issuedAt?: Date | string }).issuedAt;

  // jspdf resolves to its Node build under the node condition (tsconfig moduleResolution: node).
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(255, 253, 247);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  const eventName = (event?.title || "").trim() || "Event name";
  const center = pageWidth / 2;
  const certificateTitle = template.title || "Certificate of Participation";
  const festName = fest?.title || "YUKTI";
  const datePart = (date: Date) =>
    new Intl.DateTimeFormat("en", {
      timeZone: fest?.timezone || undefined,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).formatToParts(date);
  const schedule = fest?.startsAt && fest?.endsAt
    ? (() => {
        const startParts = datePart(fest.startsAt);
        const endParts = datePart(fest.endsAt);
        const part = (parts: Intl.DateTimeFormatPart[], type: string) => parts.find((item) => item.type === type)?.value || "";
        const startDay = part(startParts, "day");
        const startMonth = part(startParts, "month");
        const startYear = part(startParts, "year");
        const endDay = part(endParts, "day");
        const endMonth = part(endParts, "month");
        const endYear = part(endParts, "year");
        const days = (parts: Intl.DateTimeFormatPart[]) => Date.UTC(Number(part(parts, "year")), new Date(`${part(parts, "month")} 1, 2000`).getMonth(), Number(part(parts, "day")));
        const duration = Math.floor((days(endParts) - days(startParts)) / 86_400_000) + 1;
        const range = startMonth === endMonth && startYear === endYear
          ? `${startMonth} ${startDay} — ${endDay}, ${endYear}`
          : `${startMonth} ${startDay} — ${endMonth} ${endDay}, ${endYear}`;
        return `${range} · ${duration} ${duration === 1 ? "day" : "days"}`;
      })()
    : "Dates coming soon";
  doc.setDrawColor(223, 214, 189);
  doc.setLineWidth(0.4);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
  doc.setDrawColor(215, 199, 159);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  doc.setFillColor(116, 86, 236);
  doc.circle(center, 28, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.text("Y", center, 30, { align: "center" });

  doc.setTextColor(130, 128, 138);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${festName} · ${schedule}`, center, 42, { align: "center" });

  doc.setTextColor(41, 40, 58);
  doc.setFont("times", "bold");
  doc.setFontSize(21);
  const titleLines = doc.splitTextToSize(certificateTitle.toUpperCase(), pageWidth - 60);
  const titleY = 58;
  doc.text(titleLines, center, titleY, { align: "center" });
  const presentedY = titleY + titleLines.length * 8 + 6;
  doc.setDrawColor(183, 156, 85);
  doc.setLineWidth(0.7);
  doc.line(center - 10, presentedY - 5, center + 10, presentedY - 5);

  doc.setTextColor(102, 101, 115);
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.text("This certificate is proudly presented to", center, presentedY, { align: "center" });

  doc.setTextColor(70, 55, 120);
  doc.setFont("times", "bold");
  doc.setFontSize(25);
  const recipientLines = doc.splitTextToSize(recipient, pageWidth - 60);
  const recipientY = presentedY + 15;
  doc.text(recipientLines, center, recipientY, { align: "center" });

  doc.setTextColor(102, 101, 115);
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  const description = template.description || "for bringing your ideas and energy to the fest.";
  const descriptionLines = doc.splitTextToSize(description, pageWidth - 70);
  const descriptionY = recipientY + recipientLines.length * 9 + 5;
  doc.text(descriptionLines, center, descriptionY, { align: "center" });

  doc.setTextColor(40, 40, 58);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  const eventY = descriptionY + descriptionLines.length * 5 + 7;
  doc.text(doc.splitTextToSize(eventName, pageWidth - 70), center, eventY, { align: "center" });

  const signatureY = pageHeight - 41;
  doc.setDrawColor(159, 154, 160);
  doc.setLineWidth(0.3);
  doc.line(center - 25, signatureY, center + 25, signatureY);
  doc.setTextColor(57, 56, 69);
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text(template.signatureName || "Fest Coordinator", center, signatureY + 6, { align: "center" });
  doc.setTextColor(119, 117, 130);
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(template.signatureRole || "Fest Coordinator", center, signatureY + 11, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130, 128, 138);
  const issuedText = issuedAt
    ? new Date(issuedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  doc.text(
    `Issued ${issuedText} · ID: ${(certificate as { certificateId?: string }).certificateId}`,
    center,
    pageHeight - 19,
    { align: "center" },
  );

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
  const registrations = await Registration.find({ $or: [{ userId }, { memberIds: userId }] }).select("_id").lean();
  const certificates = await Certificate.find({
    registrationId: { $in: registrations.map((row) => row._id) },
    revokedAt: { $exists: false },
    staleAt: { $exists: false },
  })
    .populate("templateId", "title description eventId signatureName signatureRole logoUrl signatureImageUrl certificateType status")
    .populate("eventId", "title startsAt endsAt")
    .sort({ issuedAt: -1 })
    .lean();
  return certificates.filter((certificate) => Boolean(
    certificate.publishedAt ||
    (!(certificate as { eventId?: unknown }).eventId && (certificate.templateId as { status?: string } | null)?.status === "published"),
  ));
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
    .populate("templateId", "title eventId certificateType status")
    .populate("eventId", "title")
    .lean();
  if (!certificate) return fail(404, "NOT_FOUND", "Certificate not found");
  const published = Boolean(certificate.publishedAt || (!(certificate as { eventId?: unknown }).eventId && (certificate.templateId as { status?: string } | null)?.status === "published"));
  if (!published) return { certificateId, published: false, valid: false, status: "unpublished" };
  if (certificate.revokedAt || certificate.staleAt)
    return { certificateId, published: true, valid: false, status: "revoked" };
  const template = certificate.templateId as { title?: string; certificateType?: string } | null;
  const event = certificate.eventId as { title?: string } | null;
  return {
    certificateId: certificate.certificateId,
    issuedAt: certificate.issuedAt,
    published: true,
    valid: true,
    status: "valid",
    recipientName: certificate.recipientName,
    eventName: event?.title ?? "Event",
    certificateType: certificate.awardType ?? template?.certificateType ?? "participation",
    rank: certificate.rank ?? null,
    awardPosition: certificate.rank === 1 ? "First Place - Gold" : certificate.rank === 2 ? "Second Place - Silver" : certificate.rank === 3 ? "Third Place - Bronze" : null,
    template: { title: template?.title ?? "Certificate" },
  };
}

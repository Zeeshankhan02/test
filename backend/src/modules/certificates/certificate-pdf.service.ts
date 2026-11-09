import { fail } from "../../common/errors/app-error.js";
import { Certificate, Event, FestConfig, Registration } from "../models.js";

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

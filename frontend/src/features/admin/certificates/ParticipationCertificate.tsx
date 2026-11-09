import { useFestDates, festDateLabel, festDurationLabel } from "../../../api";

export function ParticipationCertificate({
  recipientName,
  eventName,
  title,
  description,
  signatureName,
  signatureRole,
}: {
  recipientName: string;
  eventName: string;
  title: string;
  description: string;
  signatureName: string;
  signatureRole: string;
}) {
  const festDates = useFestDates();
  const schedule = festDateLabel(festDates);
  const duration = festDurationLabel(festDates);
  return (
    <article className="participation-certificate bg-white text-zinc-900 border-zinc-300">
      <div className="certificate-inner">
        <span className="certificate-mark">Y</span>
        <small>
          {festDates?.title || "YUKTI"}
          {schedule ? ` · ${schedule}` : " · Dates coming soon"}
          {duration ? ` · ${duration}` : ""}
        </small>
        <h2>{title || "Certificate of Participation"}</h2>
        <span className="certificate-rule" />
        <p>This certificate is proudly presented to</p>
        <strong>{recipientName || "Participant Name"}</strong>
        <p>
          {description || "for bringing your ideas and energy to the fest."}
        </p>
        <span className="certificate-event">{eventName}</span>
        <div className="certificate-signature">
          <b>{signatureName || "Fest Coordinator"}</b>
          <span>{signatureRole || "Fest Coordinator"}</span>
        </div>
      </div>
    </article>
  );
}

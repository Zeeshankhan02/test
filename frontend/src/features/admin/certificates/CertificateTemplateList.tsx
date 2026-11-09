import type { CertificateTemplate, Event } from "../../../types";
import { EmptyState } from "../components/AdminShared";

type CertificateTemplateListProps = {
  templates: CertificateTemplate[];
  availableEvents: Event[];
  loading: boolean;
  certificateCount: number;
  eligibleParticipants: number;
  eligibleWinners: number;
  onPreview: (template: CertificateTemplate) => void;
  onEdit: (template: CertificateTemplate) => void;
};

export function CertificateTemplateList({
  templates,
  availableEvents,
  loading,
  certificateCount,
  eligibleParticipants,
  eligibleWinners,
  onPreview,
  onEdit,
}: CertificateTemplateListProps) {
  return (
    <section className="certificate-list">
      <div className="certificate-list-heading">
        <div>
          <span className="section-kicker">MANAGE CERTIFICATES</span>
          <h2>Certificate templates</h2>
        </div>
        <span>
          {certificateCount} certificates · {eligibleParticipants} checked in ·{" "}
          {eligibleWinners} finalists
        </span>
      </div>
      {loading ? (
        <div className="volunteer-loading">
          <i />
          <i />
          <i />
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          title="No certificates yet"
          message="Create a certificate template for one of your events."
        />
      ) : (
        <div className="certificate-table">
          <div className="certificate-row certificate-head">
            <span>CERTIFICATE</span>
            <span>EVENT</span>
            <span>RECIPIENTS</span>
            <span>STATUS</span>
            <span>CREATED</span>
            <span>ACTIONS</span>
          </div>
          {templates.map((template) => (
            <div className="certificate-row" key={template.id}>
              <b>{template.title}</b>
              <span>
                {availableEvents.find((item) => item.id === template.eventId)
                  ?.title || "—"}
              </span>
              <span>
                {template.status === "published"
                  ? template.recipientCount
                  : "—"}
              </span>
              <span>
                <i className={`certificate-state ${template.status}`}>
                  {template.status}
                </i>
              </span>
              <span>
                {new Date(template.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="certificate-row-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => onPreview(template)}
                >
                  {template.status === "published" ? "View" : "Preview"}
                </button>
                {template.status === "draft" && (
                  <button
                    className="btn btn-outline"
                    onClick={() => onEdit(template)}
                  >
                    Edit
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

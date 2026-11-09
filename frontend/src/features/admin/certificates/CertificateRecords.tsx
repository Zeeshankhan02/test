import { useState } from "react";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import type { ApiEventCertificateStatus } from "../../../api";
import CertificatePdf from "../../../CertificatePdf";
import { AdminDialog } from "../components/AdminShared";

type CertificateRecordsProps = {
  status: ApiEventCertificateStatus | null;
  festName: string;
};

export function CertificateRecords({
  status,
  festName,
}: CertificateRecordsProps) {
  const [previewRecord, setPreviewRecord] = useState<
    ApiEventCertificateStatus["certificates"][number] | null
  >(null);
  return (
    <>
      <section className="certificate-list">
        <div className="certificate-list-heading">
          <div>
            <span className="section-kicker">ISSUED RECORDS</span>
            <h2>Event certificates</h2>
          </div>
          <span>{status?.certificates.length ?? 0} records</span>
        </div>
        {(status?.certificates || []).length === 0 ? (
          <p>No certificates generated for this event yet.</p>
        ) : (
          <div className="certificate-table">
            <div className="certificate-row certificate-head">
              <span>RECIPIENT</span>
              <span>CATEGORY</span>
              <span>RANK</span>
              <span>CERTIFICATE ID</span>
              <span>STATUS</span>
            </div>
            {(status?.certificates || []).map((certificate) => {
              const template =
                typeof certificate.templateId === "object"
                  ? certificate.templateId
                  : null;
              const document = (
                <CertificatePdf
                  certificate={{ ...certificate, ...(template || {}) }}
                  eventName={status?.event.title || "Fest Event"}
                  eventDate={status?.event.endsAt}
                  festName={festName}
                  verificationUrl={`${window.location.origin}/certificate/verify/${certificate.certificateId}`}
                />
              );
              return (
                <div className="certificate-row" key={certificate._id}>
                  <b>{certificate.recipientName}</b>
                  <span>
                    {certificate.awardType === "winner"
                      ? "Achievement"
                      : "Participation"}
                  </span>
                  <span>{certificate.rank ? `#${certificate.rank}` : "—"}</span>
                  <span>
                    <button
                      className="text-link"
                      onClick={() => setPreviewRecord(certificate)}
                    >
                      {certificate.certificateId} · Preview
                    </button>{" "}
                    <PDFDownloadLink
                      className="text-link"
                      document={document}
                      fileName={`${certificate.certificateId}.pdf`}
                    >
                      {({ loading, error }) =>
                        error
                          ? "PDF error"
                          : loading
                            ? "Preparing…"
                            : "Download"
                      }
                    </PDFDownloadLink>
                  </span>
                  <span>
                    {certificate.staleAt || certificate.revokedAt
                      ? "Stale / revoked"
                      : certificate.publishedAt ||
                          (!certificate.eventId &&
                            template?.status === "published")
                        ? "Published"
                        : "Generated"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {previewRecord && (
        <AdminDialog
          title={`Certificate ${previewRecord.certificateId}`}
          close={() => setPreviewRecord(null)}
        >
          <PDFViewer style={{ width: "min(80vw, 900px)", height: "70vh" }}>
            <CertificatePdf
              certificate={{
                ...previewRecord,
                ...(typeof previewRecord.templateId === "object"
                  ? previewRecord.templateId
                  : {}),
              }}
              eventName={status?.event.title || "Fest Event"}
              eventDate={status?.event.endsAt}
              festName={festName}
              verificationUrl={`${window.location.origin}/certificate/verify/${previewRecord.certificateId}`}
            />
          </PDFViewer>
        </AdminDialog>
      )}
    </>
  );
}

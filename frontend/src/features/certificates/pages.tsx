import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import { Download, Trophy } from "lucide-react";
import { api, type ApiCertificate } from "../../api";
import CertificatePdf from "../../CertificatePdf";
import { Modal } from "../../shared/components/ui";

export function PublicCertificateVerification() {
  const { certificateId: routeId } = useParams();
  const navigate = useNavigate();
  const [value, setValue] = useState(routeId || "");
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof api.verifyCertificate>
  > | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setValue(routeId || "");
    if (!routeId) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError("");
    void api
      .verifyCertificate(routeId)
      .then(setResult)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Certificate could not be verified.",
        ),
      )
      .finally(() => setLoading(false));
  }, [routeId]);
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="eyebrow">CERTIFICATE REGISTRY</div>
        <h1>Verify a certificate</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const id = value.trim();
            if (id) navigate(`/certificate/verify/${encodeURIComponent(id)}`);
          }}
        >
          <label className="field-label">
            CERTIFICATE ID
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              required
              maxLength={64}
            />
          </label>
          <button className="btn btn-dark" disabled={loading}>
            {loading ? "Checking…" : "Verify certificate"}
          </button>
        </form>
        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}
        {result && (
          <section role="status">
            <h2>
              {result.valid
                ? "Valid certificate"
                : result.status === "unpublished"
                  ? "Not published"
                  : "Certificate is not valid"}
            </h2>
            {result.valid && (
              <>
                <p>
                  {result.recipientName} · {result.eventName}
                </p>
                <p>
                  {result.certificateType === "winner"
                    ? result.awardPosition
                    : "Certificate of Participation"}
                </p>
                <p>
                  Issued{" "}
                  {result.issuedAt
                    ? new Date(result.issuedAt).toLocaleDateString()
                    : ""}
                </p>
              </>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

export function StudentCertificates({ festName }: { festName: string }) {
  const [certificates, setCertificates] = useState<ApiCertificate[] | null>(
    null,
  );
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<ApiCertificate | null>(null);
  useEffect(() => {
    void api
      .myCertificates()
      .then(setCertificates)
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load certificates.",
        );
        setCertificates([]);
      });
  }, []);
  if (error) {
    return (
      <p className="auth-error" role="alert">
        {error}
      </p>
    );
  }
  if (!certificates) {
    return <p role="status">Loading certificates…</p>;
  }
  if (!certificates.length) {
    return (
      <p>
        No certificates yet — top scorers get theirs as soon as organizers
        publish them.
      </p>
    );
  }
  return (
    <div className="certificate-list">
      {(["participation", "winner"] as const).map((kind) => (
        <section key={kind}>
          <h3>
            {kind === "winner"
              ? "Achievement certificates"
              : "Participation certificates"}
          </h3>
          {certificates
            .filter((row) => (row.awardType || "participation") === kind)
            .map((certificate) => {
              const template =
                typeof certificate.templateId === "object"
                  ? certificate.templateId
                  : null;
              const event =
                typeof certificate.eventId === "object"
                  ? certificate.eventId
                  : null;
              const pdf = (
                <CertificatePdf
                  certificate={{
                    ...certificate,
                    title: template?.title,
                    description: template?.description,
                    signatureName: template?.signatureName,
                    signatureRole: template?.signatureRole,
                    logoUrl: template?.logoUrl,
                    signatureImageUrl: template?.signatureImageUrl,
                  }}
                  eventName={event?.title || "Fest Event"}
                  eventDate={event?.endsAt}
                  festName={festName}
                  verificationUrl={`${window.location.origin}/certificate/verify/${certificate.certificateId}`}
                />
              );
              return (
                <div
                  key={certificate._id}
                  className="panel certificate-card bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800"
                >
                  <Trophy size={20} />
                  <div>
                    <b>{template?.title ?? "Participation certificate"}</b>
                    <small>
                      {event?.title || "Fest event"} ·{" "}
                      {certificate.rank ? `Rank ${certificate.rank} · ` : ""}
                      {certificate.certificateId} · issued{" "}
                      {new Date(certificate.issuedAt).toLocaleDateString()}
                    </small>
                  </div>
                  <PDFDownloadLink
                    className="btn btn-outline"
                    document={pdf}
                    fileName={`${certificate.certificateId}.pdf`}
                  >
                    {({ loading, error: pdfError }) => (
                      <>
                        <Download size={15} />{" "}
                        {pdfError
                          ? "PDF error"
                          : loading
                            ? "Preparing…"
                            : "Download PDF"}
                      </>
                    )}
                  </PDFDownloadLink>
                  <button
                    className="btn btn-outline"
                    onClick={() => setViewing(certificate)}
                  >
                    Preview
                  </button>
                </div>
              );
            })}
        </section>
      ))}
      {viewing && (
        <Modal
          title={
            typeof viewing.templateId === "object"
              ? viewing.templateId.title
              : "Certificate"
          }
          close={() => setViewing(null)}
        >
          <PDFViewer style={{ width: "min(80vw, 900px)", height: "70vh" }}>
            <CertificatePdf
              certificate={{
                ...viewing,
                ...(typeof viewing.templateId === "object"
                  ? viewing.templateId
                  : {}),
              }}
              eventName={
                typeof viewing.eventId === "object"
                  ? viewing.eventId.title
                  : "Fest Event"
              }
              eventDate={
                typeof viewing.eventId === "object"
                  ? viewing.eventId.endsAt
                  : undefined
              }
              festName={festName}
              verificationUrl={`${window.location.origin}/certificate/verify/${viewing.certificateId}`}
            />
          </PDFViewer>
        </Modal>
      )}
    </div>
  );
}

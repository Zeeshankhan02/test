import { useEffect, useState } from "react";
import { ArrowRight, Eye, Plus } from "lucide-react";
import { api, useFestDates } from "../../../api";
import type {
  ApiEventCertificateStatus,
  ApiQuiz,
  ApiRegistration,
} from "../../../api";
import type { CertificateTemplate, Event, Registration } from "../../../types";
import { AdminDialog, type Toast } from "../components/AdminShared";
import { CertificateTemplateList } from "./CertificateTemplateList";
import { ParticipationCertificate } from "./ParticipationCertificate";
import { CertificateRecords } from "./CertificateRecords";

export function certificateRecipient(
  registration: Registration,
  participantName: string,
) {
  const teamName = registration.teamName?.trim();
  return teamName || participantName;
}

type CertificateDraft = Omit<
  CertificateTemplate,
  "id" | "status" | "createdAt" | "recipientCount"
>;
const blankDraft: CertificateDraft = {
  title: "Certificate of Participation",
  description: "for bringing your ideas and energy to the fest.",
  eventId: "",
  signatureName: "",
  signatureRole: "Fest Coordinator",
  certificateType: "participation",
  logoUrl: "",
  signatureImageUrl: "",
};
function toRegistration(row: ApiRegistration): Registration {
  return {
    id: row._id,
    eventId: row.eventId,
    userId:
      typeof row.userId === "string"
        ? row.userId
        : row.userId?.name || "Deleted user",
    teamName: row.teamName || null,
    members: row.members,
    registeredAt: row.createdAt,
    status: row.status === "confirmed" ? "confirmed" : "pending",
    ticketId: "",
  };
}
export function CertificatesPage({ toast }: { toast: Toast }) {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [certificateStatus, setCertificateStatus] =
    useState<ApiEventCertificateStatus | null>(null);
  const [quizzes, setQuizzes] = useState<ApiQuiz[]>([]);
  const [draft, setDraft] = useState<CertificateDraft>({ ...blankDraft });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [registrationId, setRegistrationId] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [previewPublished, setPreviewPublished] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [winnerCompetitionId, setWinnerCompetitionId] = useState("");
  const [loading, setLoading] = useState(true);
  const festDates = useFestDates();
  useEffect(() => {
    void Promise.all([api.certificateTemplates(), api.events(), api.quizzes()])
      .then(async ([rows, eventRows, quizRows]) => {
        const registrationRows = (
          await Promise.all(
            eventRows.map((event) => api.eventRegistrations(event.id)),
          )
        ).flat();
        setTemplates(
          rows.map((row) => ({
            id: row._id,
            title: row.title,
            description: row.description,
            eventId: row.eventId,
            signatureName: row.signatureName,
            signatureRole: row.signatureRole,
            certificateType: row.certificateType ?? "participation",
            logoUrl: row.logoUrl || "",
            signatureImageUrl: row.signatureImageUrl || "",
            status: row.status,
            createdAt: row.createdAt,
            recipientCount: 0,
          })),
        );
        setAvailableEvents(eventRows);
        setRegistrations(registrationRows.map(toRegistration));
        setQuizzes(quizRows);
        setRegistrationId(registrationRows[0]?._id || "");
        if (eventRows[0])
          setDraft((current) =>
            current.eventId
              ? current
              : { ...current, eventId: eventRows[0].id },
          );
      })
      .catch((error: unknown) =>
        toast(
          error instanceof Error
            ? error.message
            : "Could not load certificate data.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!draft.eventId) {
      setCertificateStatus(null);
      return;
    }
    let current = true;
    void api
      .eventCertificates(draft.eventId)
      .then((status) => {
        if (current) setCertificateStatus(status);
      })
      .catch((cause: unknown) => {
        if (current)
          toast(
            cause instanceof Error
              ? cause.message
              : "Could not load certificate status.",
          );
      });
    return () => {
      current = false;
    };
  }, [draft.eventId]);
  const event = availableEvents.find((item) => item.id === draft.eventId);
  const eligible = registrations.filter(
    (item) => item.eventId === draft.eventId && item.status === "confirmed",
  );
  const eventQuizzes = quizzes.filter((quiz) => quiz.eventId === draft.eventId);
  const selectedRegistration =
    eligible.find((item) => item.id === registrationId) || eligible[0];
  const validate = () => {
    const next: string[] = [];
    if (!draft.title.trim()) next.push("Add a certificate title.");
    if (!draft.description.trim()) next.push("Add a certificate description.");
    if (!draft.eventId) next.push("Choose an event.");
    if (!draft.signatureName.trim()) next.push("Add a signature name.");
    if (!draft.signatureRole.trim()) next.push("Add a signature role.");
    if (draft.certificateType === "winner" && !winnerCompetitionId)
      next.push("Choose published final-round results.");
    setErrors(next);
    return next.length === 0;
  };
  const saveDraft = async () => {
    if (!draft.title.trim()) {
      setErrors(["Add a certificate title before saving."]);
      return;
    }
    const existing = templates.find((item) => item.id === editingId);
    try {
      const saved = editingId
        ? await api.updateCertificateTemplate(editingId, draft)
        : await api.createCertificateTemplate(draft);
      const next: CertificateTemplate = {
        id: saved._id,
        ...draft,
        status: saved.status,
        createdAt: saved.createdAt,
        recipientCount: existing?.recipientCount || 0,
      };
      setTemplates((current) =>
        existing
          ? current.map((item) => (item.id === next.id ? next : item))
          : [next, ...current],
      );
      setEditingId(next.id);
      toast("Certificate draft saved");
      setErrors([]);
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "Could not save certificate draft.",
      ]);
    }
  };
  const newDraft = () => {
    setDraft({ ...blankDraft });
    setEditingId(null);
    setErrors([]);
    setRegistrationId(registrations[0]?.id || "");
  };
  const edit = (template: CertificateTemplate) => {
    setDraft({
      title: template.title,
      description: template.description,
      eventId: template.eventId,
      signatureName: template.signatureName,
      signatureRole: template.signatureRole,
      certificateType: template.certificateType ?? "participation",
      logoUrl: template.logoUrl || "",
      signatureImageUrl: template.signatureImageUrl || "",
    });
    setEditingId(template.id);
    setRegistrationId(
      registrations.find((item) => item.eventId === template.eventId)?.id || "",
    );
    setErrors([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const doPublish = () => {
    if (!validate()) return;
    setPublishConfirm(true);
  };
  const generatedForTemplate = (certificateStatus?.certificates || []).filter(
    (row) =>
      editingId &&
      (typeof row.templateId === "string"
        ? row.templateId
        : row.templateId?._id) === editingId &&
      row.awardType === (draft.certificateType || "participation") &&
      !row.publishedAt &&
      !row.staleAt &&
      !row.revokedAt,
  ).length;
  const publish = async () => {
    const existing = templates.find((item) => item.id === editingId);
    try {
      const competitionId =
        draft.certificateType === "winner" ? winnerCompetitionId : undefined;
      if (generatedForTemplate === 0) {
        const saved = editingId
          ? await api.updateCertificateTemplate(editingId, draft)
          : await api.createCertificateTemplate(draft);
        const generated = await api.generateEventCertificates(draft.eventId, {
          templateId: saved._id,
          certificateType: draft.certificateType || "participation",
          ...(competitionId ? { competitionId } : {}),
        });
        if (!generated.total) throw new Error("No eligible recipients found.");
        setEditingId(saved._id);
        setTemplates((current) =>
          current.some((item) => item.id === saved._id)
            ? current.map((item) =>
                item.id === saved._id ? { ...item, ...draft } : item,
              )
            : [
                {
                  id: saved._id,
                  ...draft,
                  status: "draft",
                  createdAt: saved.createdAt,
                  recipientCount: 0,
                },
                ...current,
              ],
        );
        await api.eventCertificates(draft.eventId).then(setCertificateStatus);
        setPublishConfirm(false);
        toast(
          `Generated ${generated.total} certificates. Review the records before publishing.`,
        );
        return;
      }
      if (!editingId)
        throw new Error(
          "Save this template before publishing generated certificates.",
        );
      const result = await api.publishEventCertificates(draft.eventId, {
        certificateType: draft.certificateType || "participation",
        ...(competitionId ? { competitionId } : {}),
      });
      const templateId = editingId;
      if (!templateId) throw new Error("Certificate template not found.");
      const template: CertificateTemplate = {
        id: templateId,
        ...draft,
        status: "published",
        createdAt: existing?.createdAt || new Date().toISOString(),
        recipientCount: result.published,
      };
      await api.eventCertificates(draft.eventId).then(setCertificateStatus);
      setTemplates((current) =>
        existing
          ? current.map((item) => (item.id === templateId ? template : item))
          : [template, ...current],
      );
      setEditingId(templateId);
      setPublishConfirm(false);
      setErrors([]);
      toast(`Published ${result.published} certificates`);
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "Could not publish certificates.",
      ]);
      setPublishConfirm(false);
    }
  };
  const update = <K extends keyof CertificateDraft>(
    key: K,
    value: CertificateDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  return (
    <>
      <div className="certificates-title">
        <div>
          <div className="eyebrow">CELEBRATE EVERY CONTRIBUTION</div>
          <h1>Certificates</h1>
          <p>Create, preview, and publish participation certificates.</p>
        </div>
        <button className="btn btn-dark" onClick={newDraft}>
          <Plus size={16} /> New certificate
        </button>
      </div>
      <div className="certificate-layout">
        <section className="certificate-builder bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="certificate-builder-heading">
            <div>
              <span className="section-kicker">CERTIFICATE BUILDER</span>
              <h2>{editingId ? "Edit certificate" : "New certificate"}</h2>
            </div>
            <span
              className={`certificate-state ${
                templates.find((item) => item.id === editingId)?.status ||
                "draft"
              }`}
            >
              {templates.find((item) => item.id === editingId)?.status ||
                "draft"}
            </span>
          </div>
          <label className="field-label">
            CERTIFICATE CATEGORY
            <select
              value={draft.certificateType || "participation"}
              onChange={(event) => {
                update(
                  "certificateType",
                  event.target.value as "participation" | "winner",
                );
                setWinnerCompetitionId("");
              }}
            >
              <option value="participation">Participation</option>
              <option value="winner">Achievement / Winner</option>
            </select>
          </label>
          {draft.certificateType === "winner" && (
            <label className="field-label">
              PUBLISHED FINAL ROUND
              <select
                value={winnerCompetitionId}
                onChange={(e) => setWinnerCompetitionId(e.target.value)}
              >
                <option value="">Choose published results</option>
                {eventQuizzes
                  .filter((quiz) => quiz.round3PublishedAt)
                  .map((quiz) => (
                    <option key={quiz._id} value={quiz._id}>
                      {quiz.title}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="certificate-form-row">
            <label className="field-label">
              FEST LOGO URL
              <input
                value={draft.logoUrl || ""}
                onChange={(event) => update("logoUrl", event.target.value)}
                placeholder="https://…"
              />
            </label>
            <label className="field-label">
              SIGNATURE IMAGE URL
              <input
                value={draft.signatureImageUrl || ""}
                onChange={(event) =>
                  update("signatureImageUrl", event.target.value)
                }
                placeholder="https://…"
              />
            </label>
          </div>
          <label className="field-label">
            CERTIFICATE TITLE
            <input
              value={draft.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Certificate of Participation"
            />
          </label>
          <label className="field-label">
            DESCRIPTION
            <textarea
              rows={3}
              value={draft.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="For participating in the fest…"
            />
          </label>
          <label className="field-label">
            EVENT
            <select
              value={draft.eventId}
              onChange={(event) => {
                update("eventId", event.target.value);
                setWinnerCompetitionId("");
                setRegistrationId(
                  registrations.find(
                    (item) => item.eventId === event.target.value,
                  )?.id || "",
                );
              }}
            >
              {availableEvents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <div className="certificate-form-row">
            <label className="field-label">
              SIGNATURE NAME
              <input
                value={draft.signatureName}
                onChange={(event) =>
                  update("signatureName", event.target.value)
                }
                placeholder="Coordinator name"
              />
            </label>
            <label className="field-label">
              SIGNATURE ROLE
              <input
                value={draft.signatureRole}
                onChange={(event) =>
                  update("signatureRole", event.target.value)
                }
                placeholder="Fest Coordinator"
              />
            </label>
          </div>
          {draft.certificateType !== "winner" && (
            <label className="field-label">
              PREVIEW RECIPIENT
              <select
                value={selectedRegistration?.id || ""}
                onChange={(event) => setRegistrationId(event.target.value)}
                disabled={!eligible.length}
              >
                {eligible.map((registration) => (
                  <option key={registration.id} value={registration.id}>
                    {certificateRecipient(
                      registration,
                      registration.members[0] || registration.userId,
                    )}{" "}
                    · {registration.teamName ? "Team" : "Solo"}
                  </option>
                ))}
              </select>
            </label>
          )}
          {errors.length > 0 && (
            <ul className="certificate-errors" role="alert">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          <div className="certificate-actions">
            <button
              className="btn btn-outline"
              onClick={() => {
                setPreviewPublished(false);
                setPreview(true);
              }}
            >
              <Eye size={15} /> Preview
            </button>
            <button className="btn btn-outline" onClick={saveDraft}>
              Save draft
            </button>
            <button
              className="btn btn-dark"
              disabled={
                templates.find((item) => item.id === editingId)?.status ===
                "published"
              }
              onClick={doPublish}
            >
              {generatedForTemplate
                ? "Publish generated certificates"
                : "Generate certificates"}{" "}
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
        <aside className="certificate-preview-pane">
          <div className="certificate-preview-label">
            <span className="section-kicker">LIVE PREVIEW</span>
            <span>{event?.title}</span>
          </div>
          <ParticipationCertificate
            recipientName={
              selectedRegistration
                ? certificateRecipient(
                    selectedRegistration,
                    selectedRegistration.members[0] ||
                      selectedRegistration.userId,
                  )
                : "No eligible participant"
            }
            eventName={event?.title || "Event name"}
            title={draft.title}
            description={draft.description}
            signatureName={draft.signatureName}
            signatureRole={draft.signatureRole}
          />
        </aside>
      </div>
      <CertificateTemplateList
        templates={templates}
        availableEvents={availableEvents}
        loading={loading}
        certificateCount={certificateStatus?.certificates.length ?? 0}
        eligibleParticipants={certificateStatus?.eligibleParticipants ?? 0}
        eligibleWinners={certificateStatus?.eligibleWinners ?? 0}
        onPreview={(template) => {
          edit(template);
          setPreviewPublished(template.status === "published");
          setPreview(true);
        }}
        onEdit={edit}
      />
      <CertificateRecords
        status={certificateStatus}
        festName={festDates?.title || "YUKTI"}
      />
      {preview && (
        <AdminDialog
          title={
            previewPublished ? "Published certificate" : "Certificate preview"
          }
          close={() => setPreview(false)}
        >
          <ParticipationCertificate
            recipientName={
              selectedRegistration
                ? certificateRecipient(
                    selectedRegistration,
                    selectedRegistration.members[0] ||
                      selectedRegistration.userId,
                  )
                : "No eligible participant"
            }
            eventName={event?.title || "Event name"}
            title={draft.title}
            description={draft.description}
            signatureName={draft.signatureName}
            signatureRole={draft.signatureRole}
          />
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              onClick={() => setPreview(false)}
            >
              Close preview
            </button>
            {!previewPublished && (
              <button
                className="btn btn-dark"
                onClick={() => {
                  setPreview(false);
                  doPublish();
                }}
              >
                Publish certificate <ArrowRight size={15} />
              </button>
            )}
          </div>
        </AdminDialog>
      )}
      {publishConfirm && (
        <AdminDialog
          title={
            generatedForTemplate
              ? "Publish generated certificates?"
              : "Generate certificates?"
          }
          close={() => setPublishConfirm(false)}
        >
          <p className="publish-copy">
            {generatedForTemplate ? (
              <>
                This will publish{" "}
                <b>{generatedForTemplate} reviewed certificates</b> for{" "}
                <b>{event?.title}</b>. Students can view them immediately.
              </>
            ) : (
              <>
                Generate certificates for{" "}
                <b>
                  {draft.certificateType === "winner"
                    ? eventQuizzes.find(
                        (quiz) => quiz._id === winnerCompetitionId,
                      )?.title || "the chosen final results"
                    : `${certificateStatus?.eligibleParticipants ?? 0} checked-in participants`}
                </b>{" "}
                from <b>{event?.title}</b>. Review the generated records before
                publishing.
              </>
            )}
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              onClick={() => setPublishConfirm(false)}
            >
              Cancel
            </button>
            <button className="btn btn-dark" onClick={publish}>
              {generatedForTemplate
                ? "Publish certificates"
                : "Generate certificates"}
            </button>
          </div>
        </AdminDialog>
      )}
    </>
  );
}

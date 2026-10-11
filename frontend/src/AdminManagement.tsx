import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { api } from "./api";
import type { ApiRegistration } from "./api";
import { useAuth } from "./AuthContext";
import type {
  Certificate,
  CertificateTemplate,
  Event,
  Registration,
  Volunteer,
} from "./types";

type Toast = (message: string) => void;
function AdminPageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="head-action">{action}</div>}
    </div>
  );
}
function AdminDialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal admin-dialog bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty-state">
      <span>
        <Users size={21} />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export function VolunteersPage({ toast }: { toast: Toast }) {
  const {
    volunteers,
    volunteersLoading: loading,
    volunteersError,
    reloadVolunteers,
    createVolunteer,
    setVolunteerStatus,
  } = useAuth();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<{
    volunteer: Volunteer;
    password: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<Volunteer | null>(null);
  const loadError = !!volunteersError;
  const filtered = volunteers.filter(
    (volunteer) =>
      volunteer.email.includes(query.trim().toLowerCase()) &&
      (statusFilter === "all" || volunteer.status === statusFilter),
  );
  const reset = () => {
    setCreateOpen(false);
    setEmail("");
    setFormError("");
    setCreated(null);
  };
  const submit = () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setFormError("Enter a valid volunteer email address.");
      return;
    }
    setBusy(true);
    setFormError("");
    void createVolunteer(normalized)
      .then((created) => {
        setCreated(created);
        toast("Volunteer account created");
      })
      .catch((cause: unknown) => {
        setFormError(
          cause instanceof Error
            ? cause.message
            : "Could not create volunteer account.",
        );
      })
      .finally(() => {
        setBusy(false);
      });
  };
  const copyPassword = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.password);
      toast("Generated password copied");
    } catch {
      setFormError(
        "Clipboard access is unavailable. Select and copy the password.",
      );
    }
  };
  return (
    <>
      <AdminPageTitle
        eyebrow="THE PEOPLE WHO MAKE IT HAPPEN"
        title="Volunteer management"
        description="Create volunteer access and manage the people on the ground."
        action={
          <button className="btn btn-dark" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Create volunteer
          </button>
        }
      />
      <div className="volunteer-stats">
        <div className="stat-card">
          <span className="stat-label">Total volunteers</span>
          <b className="stat-value">{volunteers.length}</b>
          <small>Across all fest shifts</small>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active</span>
          <b className="stat-value">
            {volunteers.filter((item) => item.status === "active").length}
          </b>
          <small>Can sign in to the volunteer workspace</small>
        </div>
      </div>
      <div className="admin-list dark:bg-zinc-900 dark:border-zinc-800">
        <div className="volunteer-toolbar">
          <div className="inline-search dark:bg-zinc-800 dark:border-zinc-700">
            <Search size={16} />
            <input
              aria-label="Search volunteer emails"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search volunteer email"
            />
          </div>
          <label className="volunteer-filter">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
        <div className="volunteer-table">
          <div className="volunteer-row volunteer-head">
            <span>EMAIL</span>
            <span>STATUS</span>
            <span>CREATED AT</span>
            <span>ACTIONS</span>
          </div>
          {loading ? (
            <div className="volunteer-loading">
              <i />
              <i />
              <i />
            </div>
          ) : loadError ? (
            <div className="empty-state">
              <h3>Volunteers didn’t load</h3>
              <p>Try loading the list again.</p>
              <button
                className="btn btn-outline"
                onClick={() => {
                  reloadVolunteers();
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            filtered.map((volunteer) => (
              <div className="volunteer-row" key={volunteer.id}>
                <b className="volunteer-email">{volunteer.email}</b>
                <span className={`volunteer-status ${volunteer.status}`}>
                  <i />
                  {volunteer.status}
                </span>
                <span>
                  {new Date(volunteer.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="volunteer-actions">
                  <button
                    className="btn btn-outline"
                    onClick={() => setView(volunteer)}
                  >
                    View
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() =>
                      void setVolunteerStatus(
                        volunteer.id,
                        volunteer.status === "active" ? "inactive" : "active",
                      ).catch((cause: unknown) =>
                        toast(
                          cause instanceof Error
                            ? cause.message
                            : "Could not update volunteer.",
                        ),
                      )
                    }
                  >
                    {volunteer.status === "active"
                      ? "Deactivate"
                      : "Reactivate"}
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
        {!loading && !loadError && !filtered.length && (
          <EmptyState
            title="No volunteers found"
            message={
              query
                ? "Try another email or clear the status filter."
                : "Create a volunteer account to get started."
            }
          />
        )}
      </div>
      {createOpen && (
        <AdminDialog
          title={created ? "Volunteer account created" : "Create volunteer"}
          close={reset}
        >
          {created ? (
            <div className="credential-success">
              <span className="auth-success-mark">
                <Check size={22} />
              </span>
              <p>
                <b>{created.volunteer.email}</b> can now sign in to the
                volunteer workspace.
              </p>
              <label className="auth-field">
                Generated password
                <span className="generated-secret">
                  <input readOnly value={created.password} />
                  <button
                    type="button"
                    onClick={copyPassword}
                    aria-label="Copy generated password"
                  >
                    <Copy size={17} />
                  </button>
                </span>
              </label>
              <small>
                Copy this now. It won’t be shown again after you close this
                dialog.
              </small>
              <div className="modal-actions">
                <button className="btn btn-dark" onClick={reset}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <label className="auth-field">
                Volunteer email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="volunteer@college.edu"
                  autoComplete="email"
                />
              </label>
              <p className="form-note">
                <ShieldCheck size={15} /> We’ll create a unique random password
                and show it once.
              </p>
              {formError && (
                <p className="auth-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={reset}>
                  Cancel
                </button>
                <button
                  className="btn btn-dark"
                  disabled={busy}
                  onClick={submit}
                >
                  {busy ? "Creating…" : "Create volunteer"}
                </button>
              </div>
            </>
          )}
        </AdminDialog>
      )}
      {view && (
        <AdminDialog title="Volunteer account" close={() => setView(null)}>
          <dl className="volunteer-details">
            <dt>Email</dt>
            <dd>{view.email}</dd>
            <dt>Status</dt>
            <dd>{view.status}</dd>
            <dt>Created</dt>
            <dd>{new Date(view.createdAt).toLocaleString()}</dd>
          </dl>
          <p className="form-note">
            For security, existing passwords can’t be viewed.
          </p>
        </AdminDialog>
      )}
    </>
  );
}

export function certificateRecipient(
  registration: Registration,
  participantName: string,
) {
  const teamName = registration.teamName?.trim();
  return teamName || participantName;
}

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
  return (
    <article className="participation-certificate bg-white text-zinc-900 border-zinc-300">
      <div className="certificate-inner">
        <span className="certificate-mark">Y</span>
        <small>YUKTI · NORTH CAMPUS FEST 2026</small>
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
};
function toRegistration(row: ApiRegistration): Registration {
  return {
    id: row._id,
    eventId: row.eventId,
    userId: typeof row.userId === "string" ? row.userId : row.userId.name,
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
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [draft, setDraft] = useState<CertificateDraft>({ ...blankDraft });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [registrationId, setRegistrationId] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [previewPublished, setPreviewPublished] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void Promise.all([api.certificateTemplates(), api.events()])
      .then(async ([rows, eventRows]) => {
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
            status: row.status,
            createdAt: row.createdAt,
            recipientCount: 0,
          })),
        );
        setAvailableEvents(eventRows);
        setRegistrations(registrationRows.map(toRegistration));
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
  const event = availableEvents.find((item) => item.id === draft.eventId);
  const eligible = registrations.filter(
    (item) => item.eventId === draft.eventId && item.status === "confirmed",
  );
  const selectedRegistration =
    eligible.find((item) => item.id === registrationId) || eligible[0];
  const validate = () => {
    const next: string[] = [];
    if (!draft.title.trim()) next.push("Add a certificate title.");
    if (!draft.description.trim()) next.push("Add a certificate description.");
    if (!draft.eventId) next.push("Choose an event.");
    if (!draft.signatureName.trim()) next.push("Add a signature name.");
    if (!draft.signatureRole.trim()) next.push("Add a signature role.");
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
  const publish = async () => {
    const existing = templates.find((item) => item.id === editingId);
    try {
      const saved = editingId
        ? await api.updateCertificateTemplate(editingId, draft)
        : await api.createCertificateTemplate(draft);
      const result = await api.publishCertificates(saved._id);
      const templateId = saved._id;
      const template: CertificateTemplate = {
        id: templateId,
        ...draft,
        status: "published",
        createdAt: saved.createdAt,
        recipientCount: result.published,
      };
      setCertificates([]);
      setTemplates((current) =>
        existing
          ? current.map((item) => (item.id === templateId ? template : item))
          : [template, ...current],
      );
      setEditingId(templateId);
      setPublishConfirm(false);
      setErrors([]);
      toast(`Certificates published for ${result.published} registrations`);
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
  ) => setDraft((current) => ({ ...current, [key]: value }));
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
            <button className="btn btn-dark" onClick={doPublish}>
              Publish certificates <ArrowRight size={15} />
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
      <section className="certificate-list">
        <div className="certificate-list-heading">
          <div>
            <span className="section-kicker">MANAGE CERTIFICATES</span>
            <h2>Certificate templates</h2>
          </div>
          <span>{certificates.length} published certificates</span>
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
                    onClick={() => {
                      edit(template);
                      setPreviewPublished(template.status === "published");
                      setPreview(true);
                    }}
                  >
                    {template.status === "published" ? "View" : "Preview"}
                  </button>
                  {template.status === "draft" && (
                    <button
                      className="btn btn-outline"
                      onClick={() => edit(template)}
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
          title="Publish certificates?"
          close={() => setPublishConfirm(false)}
        >
          <p className="publish-copy">
            This will publish certificates for{" "}
            <b>{eligible.length} registrations</b> from <b>{event?.title}</b>.
            Team registrations receive one certificate using the team name; solo
            registrations use the participant name.
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              onClick={() => setPublishConfirm(false)}
            >
              Cancel
            </button>
            <button className="btn btn-dark" onClick={publish}>
              Publish certificates
            </button>
          </div>
        </AdminDialog>
      )}
    </>
  );
}

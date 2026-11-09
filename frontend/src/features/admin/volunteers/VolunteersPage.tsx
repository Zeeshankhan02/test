import { useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../../AuthContext";
import type { Volunteer } from "../../../types";
import {
  AdminDialog,
  AdminPageTitle,
  EmptyState,
  type Toast,
} from "../components/AdminShared";

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
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<{
    volunteer: Volunteer;
    password: string;
  } | null>(null);
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

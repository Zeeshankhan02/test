import { useState } from "react";
import { ArrowRight, Bell, ShieldCheck, Ticket, Users } from "lucide-react";
import { api } from "../../api";
import { PageHead } from "../../shared/components/ui";

export function Announcement({ toast }: { toast: (s: string) => void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("All students");
  const [sending, setSending] = useState(false);
  return (
    <>
      <PageHead
        eyebrow="KEEP EVERYONE IN THE LOOP"
        title="Announcements"
        description="One clear message can make everyone’s day go smoother."
      />
      <div className="announce-layout">
        <div className="announce-form panel">
          <div className="form-section-title">
            <span>01</span>
            <div>
              <b>Who needs to know?</b>
              <small>Choose who will see your announcement.</small>
            </div>
          </div>
          <div className="audience-options">
            {["All students", "All users", "Volunteers"].map((a, i) => (
              <button
                key={a}
                className={audience === a ? "selected" : ""}
                onClick={() => setAudience(a)}
              >
                <span className="audience-icon">
                  {i === 0 ? <Users /> : <Ticket />}
                </span>
                <span>
                  <b>{a}</b>
                  <small>
                    {
                      [
                        "Everyone with a student account",
                        "Students and volunteers",
                        "Active volunteers",
                      ][i]
                    }
                  </small>
                </span>
                <i className="radio-dot" />
              </button>
            ))}
          </div>
          <div className="form-section-title">
            <span>02</span>
            <div>
              <b>Write your message</b>
              <small>Keep it short, clear, and useful.</small>
            </div>
          </div>
          <label className="field-label">
            TITLE
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A quick heads-up…"
              maxLength={60}
            />
            <small>{title.length} / 60</small>
          </label>
          <label className="field-label">
            MESSAGE
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What should everyone know?"
              rows={4}
            />
            <small>{message.length} / 280</small>
          </label>
          <button
            className="btn btn-dark btn-wide"
            disabled={sending}
            onClick={() => {
              if (!title.trim() || !message.trim()) {
                toast("Add a title and message first");
                return;
              }
              const target =
                audience === "All students"
                  ? "students"
                  : audience === "Volunteers"
                    ? "volunteers"
                    : "all";
              setSending(true);
              void api
                .announce(title.trim(), message.trim(), target)
                .then(({ delivered, email }) => {
                  toast(
                    `Announcement sent to ${delivered} accounts · email sent to ${email.sent}${email.failed ? `, failed for ${email.failed}` : ""}`,
                  );
                  setTitle("");
                  setMessage("");
                })
                .catch((cause: unknown) =>
                  toast(
                    cause instanceof Error
                      ? cause.message
                      : "Could not send announcement.",
                  ),
                )
                .finally(() => setSending(false));
            }}
          >
            {sending ? "Sending…" : "Send announcement"}{" "}
            <ArrowRight size={15} />
          </button>
          <small className="form-note">
            <ShieldCheck size={14} /> You can review before sending. This action
            will notify the selected audience.
          </small>
        </div>
        <aside className="announce-preview">
          <div className="section-kicker">
            LIVE PREVIEW <span>AS A STUDENT</span>
          </div>
          <div className="phone-preview">
            <div className="phone-top">
              <span>9:41</span>
              <span>●●● ▰</span>
            </div>
            <div className="phone-notice">
              <div className="preview-icon">
                <Bell size={17} />
              </div>
              <span className="preview-app">
                FestiQO <small>now</small>
              </span>
              <b>{title || "Your announcement title"}</b>
              <p>
                {message ||
                  "Your message will appear here, just as it will for students."}
              </p>
              <small className="audience-pill">{audience}</small>
            </div>
            <div className="phone-nav">
              <span />
              <span />
              <span />
            </div>
          </div>
          <p className="preview-hint">
            This is how it’ll look in the student notification center.
          </p>
        </aside>
      </div>
    </>
  );
}

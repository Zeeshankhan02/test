import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Compass,
  Sparkles,
  X,
} from "lucide-react";
import type { Event, User } from "../../types";
export function ProfilePage({ user }: { user: User }) {
  return (
    <section className="profile-card">
      <img src={user.avatar} alt="" />
      <div>
        <div className="eyebrow">ACCOUNT DETAILS</div>
        <h1>{user.name}</h1>
        <p>{user.email}</p>
        <span>{user.role}</span>
      </div>
    </section>
  );
}

export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="head-action">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${tone}`}>{icon}</span>
      <span className="stat-label">{label}</span>
      <b className="stat-value">{value}</b>
      <small>{detail}</small>
    </div>
  );
}

export function EventCard({ event }: { event: Event }) {
  return (
    <article className="event-card">
      <Link
        to={`/student/events/${event.id}`}
        className="event-image"
        style={{ backgroundImage: `url(${event.image})` }}
      >
        <span className="category-tag">{event.category}</span>
        <button className="event-save" aria-label="Save event">
          <Sparkles size={15} />
        </button>
      </Link>
      <div className="event-info">
        <div className="event-title-row">
          <Link to={`/student/events/${event.id}`}>
            <h3>{event.title}</h3>
          </Link>
          <span className="event-arrow">
            <ArrowUpRight size={16} />
          </span>
        </div>
        <p>{event.description}</p>
        <div className="event-where">
          <span>
            <CalendarDays size={14} />
            {new Date(`${event.date}T00:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            · {event.time}
          </span>
          <span>
            <Compass size={14} />
            {event.venue}
          </span>
        </div>
        <div className="event-footer">
          <span className="capacity">
            <span className="capacity-bar">
              <i
                style={{
                  width: `${(event.registered / event.maxParticipants) * 100}%`,
                }}
              />
            </span>
            {event.registered} / {event.maxParticipants} spots
          </span>
          <Link to={`/student/events/${event.id}`} className="small-link">
            View event <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function Podium({
  user,
  score,
  place,
  img,
}: {
  user: string;
  score: string;
  place: number;
  img: string;
}) {
  return (
    <div className={`podium-person place-${place}`}>
      <div className="podium-avatar">
        {img && <img src={img} alt="" />}
        {place === 1 && <span>✦</span>}
      </div>
      <b>{user}</b>
      <small>{score} pts</small>
      <div className="podium-step">
        <span>{place === 1 ? "1ST" : place === 2 ? "2ND" : "3RD"}</span>
      </div>
    </div>
  );
}

export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [close]);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={close}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

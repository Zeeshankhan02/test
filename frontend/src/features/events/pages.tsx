import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Download,
  Search,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { api, ApiError } from "../../api";
import type { Event } from "../../types";
import { useAuth } from "../../AuthContext";
import { Empty, EventCard, PageHead } from "../../shared/components/ui";
import { useEvents } from "./useEvents";

export function EventsPage({ toast }: { toast: (s: string) => void }) {
  const [cat, setCat] = useState("All events");
  const [q, setQ] = useState("");
  const { items: events, loading, error, reload } = useEvents();
  const found = events.filter(
    (e) =>
      (cat === "All events" || e.category === cat) &&
      e.title.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHead
        eyebrow="THE FULL LINEUP"
        title="Explore events"
        description="Find the thing you’ll be talking about next week."
        action={
          <button
            className="btn btn-dark"
            onClick={() => toast("Event calendar downloaded")}
          >
            <Download size={16} /> Calendar
          </button>
        }
      />
      <div className="events-tools">
        <div className="inline-search">
          <Search size={17} />
          <input
            placeholder="Search events"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="filter-row">
          {["All events", "Technical", "Music", "Creative"].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`filter-pill ${cat === c ? "selected" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="event-grid">
        {found.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
      {loading && <p role="status">Loading published events…</p>}
      {error && (
        <div role="alert" className="auth-error">
          {error}{" "}
          <button className="btn btn-outline" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && !found.length && (
        <Empty
          icon={<Compass />}
          title="No events found"
          text="Try a different event name or category."
        />
      )}
    </>
  );
}

export function EventDetail({ toast }: { toast: (s: string) => void }) {
  const eventId = window.location.pathname.split("/").pop() || "";
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    void api
      .event(eventId)
      .then(setEvent)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load event.",
        ),
      )
      .finally(() => setLoading(false));
  }, [eventId]);
  const { user } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [registrationType, setRegistrationType] = useState<
    "individual" | "team"
  >("individual");
  const [teamName, setTeamName] = useState("");
  const [memberEmailsText, setMemberEmailsText] = useState("");
  useEffect(() => {
    if (event?.participationType === "team") setRegistrationType("team");
  }, [event?.participationType]);
  const [registrationStatus, setRegistrationStatus] = useState<
    "checking" | "available" | "registered" | "error"
  >("checking");
  useEffect(() => {
    setRegistrationStatus("checking");
    void api
      .registrations()
      .then((rows) =>
        setRegistrationStatus(
          rows.some((registration) => registration.eventId === eventId)
            ? "registered"
            : "available",
        ),
      )
      .catch(() => setRegistrationStatus("error"));
  }, [eventId]);
  useEffect(() => {
    if (!event) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [event?.id]);
  const eventFull = !!event && event.registered >= event.maxParticipants;
  const eventEnded =
    !!event &&
    (event.status === "ended" ||
      (!!event.endsAt && Date.parse(event.endsAt) <= now));
  const eventStarted =
    !!event &&
    (event.status === "live" ||
      eventEnded ||
      (!!event.startsAt && Date.parse(event.startsAt) <= now));
  const registrationClosedReason = eventEnded
    ? "This event has ended. Registration is closed."
    : eventStarted
      ? "This event has already started. Registration is closed."
      : eventFull
        ? "This event is full. Registration is closed."
        : "";
  const lastAvailabilityNotice = useRef("");
  useEffect(() => {
    if (!event || !registrationClosedReason) return;
    const noticeKey = `${event.id}:${registrationClosedReason}`;
    if (lastAvailabilityNotice.current === noticeKey) return;
    lastAvailabilityNotice.current = noticeKey;
    toast(registrationClosedReason);
  }, [event?.id, registrationClosedReason, toast]);
  if (loading) return <p role="status">Loading event…</p>;
  if (error || !event)
    return (
      <Empty
        icon={<Compass />}
        title="Event unavailable"
        text={error || "This event may no longer be published."}
      />
    );
  const register = async () => {
    if (
      !user ||
      registering ||
      registrationStatus !== "available" ||
      registrationClosedReason
    )
      return;
    setRegistering(true);
    try {
      const memberEmails = memberEmailsText
        .split(/[\n,]+/)
        .map((email) => email.trim())
        .filter(Boolean);
      await api.register(
        event.id,
        registrationType,
        teamName.trim(),
        memberEmails,
      );
      setRegistrationStatus("registered");
      toast(`You’re registered for ${event.title}. Your ticket is ready.`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "EVENT_FULL") {
        setEvent((current) =>
          current
            ? { ...current, registered: current.maxParticipants }
            : current,
        );
        return;
      }
      if (cause instanceof ApiError && cause.code === "REGISTRATION_CLOSED") {
        setNow(Date.now());
        if (
          event.status === "upcoming" &&
          event.startsAt &&
          Date.parse(event.startsAt) > Date.now()
        ) {
          setRegistrationStatus("error");
          toast(cause.message);
        }
        return;
      }
      toast(
        cause instanceof Error
          ? cause.message
          : "Could not register for this event.",
      );
    } finally {
      setRegistering(false);
    }
  };
  const requestedMemberEmails = memberEmailsText
    .split(/[\n,]+/)
    .map((email) => email.trim())
    .filter(Boolean);
  const normalizedTeamEmails = requestedMemberEmails.map((email) =>
    email.toLowerCase(),
  );
  const leaderEmailIncluded = Boolean(
    user?.email && normalizedTeamEmails.includes(user.email.toLowerCase()),
  );
  const configuredTeamSize =
    requestedMemberEmails.length +
    Number(Boolean(event.teamLeaderIncluded && !leaderEmailIncluded));
  const teamEmailError = normalizedTeamEmails.some(
    (email, index) => normalizedTeamEmails.indexOf(email) !== index,
  )
    ? "Remove duplicate member emails."
    : normalizedTeamEmails.some(
          (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        )
      ? "Enter a valid student account email for each member."
      : !event.teamLeaderIncluded &&
          user?.email &&
          normalizedTeamEmails.includes(user.email.toLowerCase())
        ? "The leader is added automatically; do not include your own email."
        : "";
  return (
    <>
      <Link to="/student/events" className="back-link">
        ← All events
      </Link>
      <div
        className="detail-hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(14,22,35,.88),rgba(14,22,35,.1)),url(${event.image})`,
        }}
      >
        <span className="category-tag">{event.category}</span>
        <h1>{event.title}</h1>
        <p>{event.description}</p>
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <h2>About this event</h2>
          <p className="body-copy">
            Bring your curiosity, your favorite people, and an open mind. This
            is a space to make something, meet someone, and leave with a story
            worth sharing. All experience levels are welcome.
          </p>
          <h3>What to expect</h3>
          <div className="expect-grid">
            <span>
              <Sparkles /> Hands-on experiences
            </span>
            <span>
              <Users /> Meet your people
            </span>
            <span>
              <Trophy /> Prizes & bragging rights
            </span>
          </div>
        </div>
        <aside className="register-card">
          <span className="eyebrow">SAVE YOUR SPOT</span>
          <h3>Everything you need to know.</h3>
          <p>
            <CalendarDays />
            {new Date(`${event.date}T00:00:00`).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · {event.time}
          </p>
          <p>
            <Compass />
            {event.venue}
          </p>
          <p>
            <Users />
            {event.registered} of {event.maxParticipants} spots filled
          </p>
          {event.participationType === "both" && (
            <label>
              Participation type
              <select
                value={registrationType}
                onChange={(e) =>
                  setRegistrationType(e.target.value as "individual" | "team")
                }
              >
                <option value="individual">Solo registration</option>
                <option value="team">Team registration</option>
              </select>
            </label>
          )}
          {(event.participationType === "team" ||
            (event.participationType === "both" &&
              registrationType === "team")) && (
            <>
              <label>
                Team name
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  maxLength={100}
                  placeholder="Enter team name"
                />
              </label>
              <label>
                Teammate account emails ({event.teamMin}–{event.teamMax} counted
                members; your leader account is added automatically)
                <textarea
                  value={memberEmailsText}
                  onChange={(e) => setMemberEmailsText(e.target.value)}
                  placeholder="Add one student account email per line"
                />
              </label>
              {teamEmailError && (
                <small className="auth-error" role="alert">
                  {teamEmailError}
                </small>
              )}
              <small>
                Team preview: {user?.name} (leader)
                {requestedMemberEmails.filter(
                  (email) => email.toLowerCase() !== user?.email.toLowerCase(),
                ).length
                  ? ` · ${requestedMemberEmails.filter((email) => email.toLowerCase() !== user?.email.toLowerCase()).join(" · ")}`
                  : " · Add your teammates above"}
              </small>
            </>
          )}
          <button
            className="btn btn-dark btn-wide"
            onClick={() => void register()}
            disabled={
              registering ||
              !!registrationClosedReason ||
              registrationStatus === "checking" ||
              registrationStatus === "registered" ||
              registrationStatus === "error" ||
              (registrationType === "team" &&
                (teamName.trim().length < 2 ||
                  !/^[\p{L}\p{N} _.-]+$/u.test(teamName.trim()) ||
                  !!teamEmailError ||
                  configuredTeamSize < (event.teamMin ?? 2) ||
                  configuredTeamSize > (event.teamMax ?? 20)))
            }
          >
            {eventEnded
              ? "Event ended"
              : eventStarted
                ? "Event already started"
                : eventFull
                  ? "Event full"
                  : registrationStatus === "registered"
                    ? "Already registered"
                    : registrationStatus === "checking"
                      ? "Checking registration…"
                      : registrationStatus === "error"
                        ? "Registration unavailable"
                        : registering
                          ? "Registering…"
                          : "Register for free"}{" "}
            <ArrowRight size={16} />
          </button>
          <small>
            {registrationClosedReason ||
              (registrationStatus === "error"
                ? "Could not verify your registration. Refresh the page to try again."
                : "No payment required · Limited spots available")}
          </small>
        </aside>
      </div>
    </>
  );
}

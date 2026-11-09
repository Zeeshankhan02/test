import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Clock3,
  Compass,
  Music2,
  Sparkles,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import {
  api,
  daysUntil,
  festDateLabel,
  festDurationLabel,
  useFestDates,
  type ApiQuiz,
  type ApiRegistration,
} from "../../api";
import type { User, Notice } from "../../types";
import { Empty, EventCard, Stat } from "../../shared/components/ui";
import { StudentCertificates } from "../certificates/pages";
import { useEvents } from "../events/useEvents";

export function StudentDashboard({
  user,
  quizzes,
}: {
  user: User;
  quizzes: ApiQuiz[];
}) {
  const [filter, setFilter] = useState("All events");
  const festDates = useFestDates();
  const festLabel = festDateLabel(festDates);
  const festDuration = festDurationLabel(festDates);
  const festName = festDates?.title ?? "YUKTI";
  const { items: events, loading, error } = useEvents();
  const [registrations, setRegistrations] = useState<ApiRegistration[]>([]);
  const [registrationError, setRegistrationError] = useState("");
  const [latestNotice, setLatestNotice] = useState<Notice | null>(null);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [noticesError, setNoticesError] = useState(false);
  const [quizRank, setQuizRank] = useState<{
    rank: number;
    detail: string;
  } | null>(null);
  const [quizRankLoading, setQuizRankLoading] = useState(true);
  useEffect(() => {
    void api
      .registrations()
      .then(setRegistrations)
      .catch((cause: unknown) =>
        setRegistrationError(
          cause instanceof Error
            ? cause.message
            : "Could not load registrations.",
        ),
      );
  }, []);
  useEffect(() => {
    let disposed = false;
    setQuizRankLoading(true);
    void Promise.allSettled(
      quizzes.map(async (quiz) => ({
        quiz,
        board: await api.competitionLeaderboards(quiz._id),
      })),
    ).then((results) => {
      if (disposed) return;
      const rounds = ["final", "round2", "round1"] as const;
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const { quiz, board } = result.value;
        const publishedRank = rounds
          .filter((round) => board[round].published)
          .map((round) => ({
            round,
            row: board[round].rankings.find(
              (entry) => entry.userId === user.id,
            ),
          }))
          .find((entry) => entry.row);
        if (publishedRank?.row) {
          const roundLabel =
            publishedRank.round === "round1"
              ? "Round 1"
              : publishedRank.round === "round2"
                ? "Round 2"
                : "Final";
          setQuizRank({
            rank: publishedRank.row.rank,
            detail: `${roundLabel} · ${quiz.title}`,
          });
          break;
        }
      }
      setQuizRankLoading(false);
    });
    return () => {
      disposed = true;
    };
  }, [quizzes, user.id]);
  useEffect(() => {
    let disposed = false;
    void api
      .notices()
      .then((notices) => {
        if (!disposed) setLatestNotice(notices[0] ?? null);
      })
      .catch(() => {
        if (!disposed) setNoticesError(true);
      })
      .finally(() => {
        if (!disposed) setNoticesLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, []);
  const shown = useMemo(
    () =>
      events.filter((e) => filter === "All events" || e.category === filter),
    [events, filter],
  );
  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <div className="eyebrow hero-eyebrow">
            <i /> {festName} PRESENTS
          </div>
          <h1>
            Where ideas
            <br />
            meet <em>energy.</em>
          </h1>
          <p>
            {festDuration
              ? `${festDuration[0].toUpperCase()}${festDuration.slice(1)} of big ideas, new faces and moments that stay with you.`
              : "Big ideas, new faces and moments that stay with you. Fest dates coming soon."}
            Your fest starts here.
          </p>
          <div className="hero-buttons">
            <Link className="btn btn-white" to="/student/events">
              Explore events <ArrowRight size={16} />
            </Link>
            <Link className="btn btn-glass" to="/student/tickets">
              My tickets <Ticket size={16} />
            </Link>
          </div>
          <div className="hero-meta">
            <span>
              <CalendarDays size={15} /> {festLabel ?? "Dates coming soon"}
              {festDuration ? ` · ${festDuration}` : ""}
            </span>
            <span className="meta-divider" />
            <span>
              <Users size={15} /> 2,400+ joining
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-photo" />
          <div className="hero-chip chip-top">
            <span className="live-dot" />{" "}
            {festDuration
              ? `${festDuration.toUpperCase()} OF WHAT’S NEXT`
              : "WHAT’S NEXT"}
          </div>
          <div className="hero-sticker">
            <span>
              THINK
              <br />
              BIG.
            </span>
            <Sparkles size={20} />
          </div>
          <div className="hero-chip chip-bottom">
            <span className="chip-icon">
              <Music2 size={14} />
            </span>
            TECH · MUSIC · CULTURE
          </div>
        </div>
      </section>
      <section className="stats-row">
        <Stat
          label="Your registrations"
          value={String(registrations.length).padStart(2, "0")}
          detail={
            registrations.length === 1
              ? "One event on your list"
              : "Events on your list"
          }
          icon={<Ticket size={18} />}
          tone="lavender"
        />
        <Stat
          label="Fest starts in"
          value={festDates?.startsAt ? daysUntil(festDates.startsAt) : "—"}
          detail={
            festDates?.startsAt
              ? new Date(festDates.startsAt).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : "Dates coming soon"
          }
          icon={<Clock3 size={18} />}
          tone="peach"
        />
        <Stat
          label="Your quiz rank"
          value={quizRankLoading ? "…" : quizRank ? `#${quizRank.rank}` : "—"}
          detail={
            quizRankLoading
              ? "Checking published results"
              : (quizRank?.detail ?? "No published ranking yet")
          }
          icon={<Trophy size={18} />}
          tone="mint"
        />
      </section>
      <section className="content-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">HALL OF FAME</div>
            <h2>Your certificates.</h2>
            <p>Top scorers get theirs as soon as organizers publish results.</p>
          </div>
        </div>
        <StudentCertificates festName={festName} />
      </section>
      <section className="content-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FIND YOUR THING</div>
            <h2>Made for your kind of curious.</h2>
            <p>Pick a lane or let the day surprise you.</p>
          </div>
          <Link className="text-link" to="/student/events">
            All events <ArrowRight size={16} />
          </Link>
        </div>
        <div className="filter-row">
          {["All events", "Technical", "Music", "Creative"].map((x) => (
            <button
              className={`filter-pill ${x === filter ? "selected" : ""}`}
              key={x}
              onClick={() => setFilter(x)}
            >
              {x === "Music" ? (
                <Music2 size={14} />
              ) : x === "Technical" ? (
                <Activity size={14} />
              ) : null}
              {x}
            </button>
          ))}
        </div>
        <div className="event-grid">
          {shown.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        {loading && <p role="status">Loading published events…</p>}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && !shown.length && (
          <Empty
            icon={<Compass />}
            title="No published events yet"
            text="Check back when the fest team publishes its lineup."
          />
        )}
      </section>
      <section className="bottom-grid">
        <div className="next-event-card">
          <div className="next-label">
            <span className="live-dot purple-dot" /> NEXT UP FOR YOU
          </div>
          {registrationError && (
            <p className="auth-error" role="alert">
              {registrationError}
            </p>
          )}
          {registrations[0] ? (
            <div className="next-body">
              <div>
                <span className="category-tag">
                  {events.find((event) => event.id === registrations[0].eventId)
                    ?.category || "EVENT"}
                </span>
                <h3>
                  {events.find((event) => event.id === registrations[0].eventId)
                    ?.title || "Your registered event"}
                </h3>
                <p>
                  {registrations[0].teamName || "Individual registration"} ·
                  Registration confirmed
                </p>
                <div className="next-details">
                  <span>
                    <CalendarDays size={14} />{" "}
                    {new Date(registrations[0].createdAt).toLocaleDateString()}
                  </span>
                  <span>
                    <Ticket size={14} /> Ticket ready
                  </span>
                </div>
              </div>
              <Link to="/student/tickets" className="btn btn-dark">
                Open ticket <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            !registrationError && (
              <p>You haven’t registered for an event yet.</p>
            )
          )}
        </div>
        <div className="mini-notice">
          <div className="mini-notice-top">
            <span className="eyebrow">IN THE LOOP</span>
            <Link
              className="icon-button"
              to="/student/notifications"
              aria-label="View notifications"
            >
              <ArrowRight size={16} />
            </Link>
          </div>
          {noticesLoading ? (
            <p role="status">Loading your latest update…</p>
          ) : noticesError ? (
            <>
              <h3>Updates unavailable</h3>
              <p>We couldn’t load your latest announcements.</p>
            </>
          ) : latestNotice ? (
            <>
              <h3>{latestNotice.title}</h3>
              <p>{latestNotice.message}</p>
              <span className="notice-time">
                <span className="notice-dot" />
                {new Date(latestNotice.timestamp).toLocaleString()}
              </span>
            </>
          ) : (
            <>
              <h3>You’re all caught up</h3>
              <p>No announcements or updates yet.</p>
            </>
          )}
        </div>
      </section>
    </>
  );
}

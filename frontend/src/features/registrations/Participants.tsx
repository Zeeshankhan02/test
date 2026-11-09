import { useEffect, useState } from "react";
import { Check, Download, Flame, Search, Users } from "lucide-react";
import { api, type ApiRegistration } from "../../api";
import type { Event } from "../../types";
import { PageHead, Stat } from "../../shared/components/ui";

export function Participants() {
  const [rows, setRows] = useState<ApiRegistration[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [dashboard, setDashboard] = useState<Awaited<
    ReturnType<typeof api.dashboard>
  > | null>(null);
  const [query, setQuery] = useState("");
  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([api.events(), api.dashboard()])
      .then(([items, stats]) => {
        setEvents(items);
        setDashboard(stats);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load participants.",
        ),
      );
  }, []);
  useEffect(() => {
    void api
      .participants({ eventId, status, limit: 100 })
      .then(setRows)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load participants.",
        ),
      );
  }, [eventId, status]);
  const visible = rows.filter((row) => {
    const person =
      typeof row.userId === "string"
        ? row.userId
        : row.userId
          ? `${row.userId.name} ${row.userId.email}`
          : "Deleted user";
    return `${person} ${row.teamName || ""}`
      .toLowerCase()
      .includes(query.toLowerCase());
  });
  const download = () => {
    const csv = [
      "Participant,Email,Event,Team,Registered,Status",
      ...visible.map((row) => {
        const user =
          typeof row.userId === "string"
            ? { name: row.userId, email: "" }
            : (row.userId ?? { name: "Deleted user", email: "" });
        const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
        return [
          user.name,
          user.email,
          events.find((item) => item.id === row.eventId)?.title || "",
          row.teamName || "",
          row.createdAt,
          row.status,
        ]
          .map(quote)
          .join(",");
      }),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "fest-participants.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHead
        eyebrow="YOUR COMMUNITY, IN ONE PLACE"
        title="Participants"
        description="A live look at everyone showing up for the fest."
        action={
          <button className="btn btn-outline" onClick={download}>
            <Download size={15} /> Export list
          </button>
        }
      />
      <div className="participant-stats">
        <Stat
          label="Registered"
          value={String(dashboard?.registrations ?? "—")}
          detail={`Across ${dashboard?.events ?? 0} events`}
          icon={<Users />}
          tone="lavender"
        />
        <Stat
          label="Teams"
          value={String(dashboard?.teamRegistrations ?? "—")}
          detail="Team registrations"
          icon={<Flame />}
          tone="peach"
        />
        <Stat
          label="Checked in"
          value={String(dashboard?.checkIns ?? "—")}
          detail="Tickets checked in"
          icon={<Check />}
          tone="mint"
        />
      </div>
      <div className="logs-card">
        <div className="logs-toolbar">
          <div className="inline-search">
            <Search size={16} />
            <input
              placeholder="Search participants"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="btn btn-outline"
            aria-label="Filter by event"
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
          >
            <option value="">All events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          <select
            className="btn btn-outline"
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Any status</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="logs-table">
          <div className="participant-head">
            <span>PARTICIPANT</span>
            <span>EVENT / TEAM</span>
            <span>REGISTERED</span>
            <span>STATUS</span>
          </div>
          {visible.map((row) => {
            const person =
              typeof row.userId === "string"
                ? { name: row.userId, email: "" }
                : (row.userId ?? { name: "Deleted user", email: "" });
            const event = events.find((item) => item.id === row.eventId);
            return (
              <div className="participant-row" key={row._id}>
                <div className="logs-participant">
                  <span className="participant-avatar">
                    {person.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <b>{person.name}</b>
                    <small>{person.email}</small>
                  </span>
                </div>
                <span>
                  <b>{event?.title || "Event"}</b>
                  <small>{row.teamName || "Individual registration"}</small>
                </span>
                <span className="logs-time">
                  {new Date(row.createdAt).toLocaleDateString()}
                </span>
                <span className="status-valid">
                  <i />
                  {row.status}
                </span>
              </div>
            );
          })}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {!error && !visible.length && (
            <p>No participants match these filters.</p>
          )}
        </div>
      </div>
    </>
  );
}

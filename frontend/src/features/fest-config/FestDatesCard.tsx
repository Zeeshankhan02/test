import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { api, festDateLabel, type ApiFestDates } from "../../api";

export function FestDatesCard({ toast }: { toast: (s: string) => void }) {
  const [dates, setDates] = useState<ApiFestDates | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [venue, setVenue] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void api
      .festDates()
      .then((value) => {
        setDates(value);
        setTitle(value?.title ?? "");
        setStartsAt(toLocalInput(value?.startsAt));
        setEndsAt(toLocalInput(value?.endsAt));
        setVenue(value?.venue ?? "");
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);
  const save = () => {
    if (!startsAt || !endsAt) {
      toast("Pick both a start and an end date");
      return;
    }
    setSaving(true);
    void api
      .saveFestDates({
        title: title.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        venue: venue.trim() || undefined,
      })
      .then((value) => {
        setDates(value);
        toast("Fest dates saved");
      })
      .catch((cause: unknown) =>
        toast(
          cause instanceof Error ? cause.message : "Could not save fest dates.",
        ),
      )
      .finally(() => setSaving(false));
  };
  const label = festDateLabel(dates);
  return (
    <div className="panel fest-dates-card bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">
      <span className="section-kicker">FEST SCHEDULE</span>
      <h3>{dates?.title || "YUKTI"}</h3>
      <p>
        <CalendarDays size={15} />{" "}
        {label ?? "No dates configured yet — students see the default."}
        {dates?.venue ? ` · ${dates.venue}` : ""}
      </p>
      <div className="fest-dates-form">
        <label>
          FEST NAME
          <input
            className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="YUKTI"
          />
        </label>
        <label>
          STARTS
          <input
            type="datetime-local"
            className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label>
          ENDS
          <input
            type="datetime-local"
            className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
        <label>
          VENUE
          <input
            className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Main campus auditorium"
          />
        </label>
      </div>
      <button
        className="btn btn-dark"
        disabled={saving || !loaded}
        onClick={save}
      >
        {saving ? "Saving…" : "Save fest dates"} <ArrowRight size={15} />
      </button>
    </div>
  );
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

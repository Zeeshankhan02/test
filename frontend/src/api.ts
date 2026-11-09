import { useEffect, useState } from "react";
import type { ApiFestDates } from "./api/types";
import {
  getFestDatesCache,
  setFestDatesCache,
  subscribeFestDatesCache,
} from "./api/festDatesCache";
import { authApi } from "./api/services/auth.api";
import { eventsApi } from "./api/services/events.api";
import { registrationsApi } from "./api/services/registrations.api";
import { ticketsApi } from "./api/services/tickets.api";
import { scansApi } from "./api/services/scans.api";
import { volunteersApi } from "./api/services/volunteers.api";
import { notificationsApi } from "./api/services/notifications.api";
import { dashboardApi } from "./api/services/dashboard.api";
import { festConfigApi } from "./api/services/festConfig.api";
import { quizzesApi } from "./api/services/quizzes.api";
import { certificatesApi } from "./api/services/certificates.api";
export { ApiError, refreshSession } from "./api/client";
export type * from "./api/types";

/** Shared hook: fetch the configured fest dates once per app load. */
export function useFestDates(): ApiFestDates | null {
  const [dates, setDates] = useState<ApiFestDates | null>(
    getFestDatesCache() ?? null,
  );
  useEffect(() => {
    const unsubscribe = subscribeFestDatesCache(setDates);
    if (getFestDatesCache() !== undefined) return unsubscribe;
    void api
      .festDates()
      .then(setFestDatesCache)
      .catch(() => setFestDatesCache(null));
    return unsubscribe;
  }, []);
  return dates;
}

/** "19 days" / "starts today" countdown from an ISO date string. */
export function daysUntil(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.floor(
    (Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      dayMs,
  );
  if (diff <= 0) return "starts today";
  if (diff === 1) return "1 day";
  return `${diff} days`;
}

/** "OCT 15 — 17, 2026" style label, or null when nothing is configured. */
export function festDateLabel(dates: ApiFestDates | null): string | null {
  if (!dates?.startsAt || !dates?.endsAt) return null;
  const parts = (value: string): Record<string, string> =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en", {
        timeZone: dates.timezone || undefined,
        month: "short",
        day: "numeric",
        year: "numeric",
      })
        .formatToParts(new Date(value))
        .map(({ type, value: part }) => [type, part]),
    );
  const start = parts(dates.startsAt);
  const end = parts(dates.endsAt);
  const startMonth = start.month.toUpperCase();
  const endMonth = end.month.toUpperCase();
  return startMonth === endMonth && start.year === end.year
    ? `${startMonth} ${start.day} — ${end.day}, ${end.year}`
    : `${startMonth} ${start.day} — ${endMonth} ${end.day}, ${end.year}`;
}

export function festDurationLabel(dates: ApiFestDates | null): string | null {
  if (!dates?.startsAt || !dates?.endsAt) return null;
  const parts = (value: string): Record<string, number> =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en", {
        timeZone: dates.timezone || undefined,
        year: "numeric",
        month: "numeric",
        day: "numeric",
      })
        .formatToParts(new Date(value))
        .map(({ type, value: part }) => [type, Number(part)]),
    );
  const start = parts(dates.startsAt);
  const end = parts(dates.endsAt);
  const startDay = Date.UTC(start.year, start.month - 1, start.day);
  const endDay = Date.UTC(end.year, end.month - 1, end.day);
  const days = Math.floor((endDay - startDay) / 86_400_000) + 1;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export const api = {
  ...authApi,
  ...eventsApi,
  ...registrationsApi,
  ...ticketsApi,
  ...scansApi,
  ...volunteersApi,
  ...notificationsApi,
  ...dashboardApi,
  ...festConfigApi,
  ...quizzesApi,
  ...certificatesApi,
};

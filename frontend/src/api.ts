import type { Event, Notice, Role, Scan, User, Volunteer } from "./types";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

/** Shared hook: fetch the configured fest dates once per app load. */
let festDatesCache: ApiFestDates | null | undefined;
export function useFestDates(): ApiFestDates | null {
  const [dates, setDates] = useState<ApiFestDates | null>(
    festDatesCache ?? null,
  );
  useEffect(() => {
    if (festDatesCache !== undefined) return;
    void api
      .festDates()
      .then((value) => {
        festDatesCache = value;
        setDates(value);
      })
      .catch(() => {
        festDatesCache = null;
      });
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
  const start = new Date(dates.startsAt);
  const end = new Date(dates.endsAt);
  const month = start.toLocaleString("en", { month: "short" }).toUpperCase();
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    return `${month} ${start.getDate()} — ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${month} ${start.getDate()} — ${end.toLocaleString("en", { month: "short" }).toUpperCase()} ${end.getDate()}, ${end.getFullYear()}`;
}

const baseUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1"
).replace(/\/$/, "");
let accessToken: string | null = null;
let refreshPromise: Promise<{
  accessToken: string;
  user: ApiUser;
} | null> | null = null;

type ApiUser = { id: string; name: string; email: string; role: Role };
type ApiEvent = {
  _id: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  status: string;
  capacity: number;
  registeredCount: number;
  image?: string;
  imagePublicId?: string;
  registrationDeadline?: string;
};
type Envelope<T> = { success: true; data: T };

function toUser(user: ApiUser): User {
  return {
    ...user,
    avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(user.email)}`,
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function raw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const result = (await response.json().catch(() => null)) as
    (Envelope<T> & { message?: string; error?: { code?: string } }) | null;
  if (!response.ok)
    throw new ApiError(
      result?.message || `Request failed (${response.status})`,
      response.status,
      result?.error?.code,
    );
  return (result as Envelope<T>).data;
}

export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const session = await raw<{ accessToken: string; user: ApiUser }>(
          "/auth/refresh",
          { method: "POST" },
        );
        accessToken = session.accessToken;
        return session;
      } catch {
        accessToken = null;
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  try {
    return await raw<T>(path, init);
  } catch (error) {
    const isUnauthorized =
      error instanceof Error && error.message === "Authentication required";
    if (retry && isUnauthorized && !path.startsWith("/auth/")) {
      const session = await refreshSession();
      if (session) return request<T>(path, init, false);
    }
    throw error;
  }
}

const json = (method: string, value?: unknown): RequestInit => ({
  method,
  ...(value === undefined ? {} : { body: JSON.stringify(value) }),
});

export type UploadedEventImage = { url: string; publicId: string };

export const api = {
  async login(email: string, password: string) {
    const session = await raw<{ accessToken: string; user: ApiUser }>(
      "/auth/login",
      json("POST", { email, password }),
    );
    accessToken = session.accessToken;
    return toUser(session.user);
  },
  async signup(name: string, email: string, password: string) {
    const session = await raw<{ accessToken: string; user: ApiUser }>(
      "/auth/signup",
      json("POST", { name, email, password }),
    );
    accessToken = session.accessToken;
    return toUser(session.user);
  },
  async logout() {
    try {
      await request("/auth/logout", json("POST"));
    } finally {
      accessToken = null;
    }
  },
  async changePassword(currentPassword: string, newPassword: string) {
    await request(
      "/auth/password",
      json("PATCH", { currentPassword, newPassword }),
    );
    accessToken = null;
  },
  requestPasswordReset: (email: string) =>
    request<{ message: string }>(
      "/auth/password/forgot",
      json("POST", { email }),
    ),
  resetPassword: (token: string, password: string) =>
    request<{ changed: boolean }>(
      "/auth/password/reset",
      json("POST", { token, password }),
    ),
  events: async (
    filters: { q?: string; category?: string; limit?: number } = {},
  ) => {
    const query = new URLSearchParams();
    if (filters.q) query.set("q", filters.q);
    if (filters.category) query.set("category", filters.category);
    if (filters.limit) query.set("limit", String(filters.limit));
    const result = await request<ApiEvent[] | { data: ApiEvent[] }>(
      `/events${query.size ? `?${query}` : ""}`,
    );
    const rows = Array.isArray(result) ? result : result.data;
    return rows.map(toEvent);
  },
  event: async (id: string) =>
    toEvent(await request<ApiEvent>(`/events/${id}`)),
  eventRecord: (id: string) => request<ApiEvent>(`/events/${id}`),
  createEvent: async (value: EventDraft) =>
    toEvent(await request<ApiEvent>("/events", json("POST", value))),
  /** Uploads a poster to Cloudinary through the backend before the event exists. */
  uploadEventImage: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return request<UploadedEventImage>("/events/images", {
      method: "POST",
      body: form,
    });
  },
  /** Deletes an uploaded poster that is no longer needed (failed creation, replaced image). */
  deleteEventImage: (publicId: string) =>
    request<{ deleted: boolean }>(
      `/events/images/${encodeURIComponent(publicId)}`,
      json("DELETE"),
    ),
  deleteEvent: (id: string) =>
    request<{ deleted: boolean }>(`/events/${id}`, json("DELETE")),
  updateEvent: async (id: string, value: Partial<EventDraft>) =>
    toEvent(await request<ApiEvent>(`/events/${id}`, json("PATCH", value))),
  publishEvent: async (id: string) =>
    toEvent(await request<ApiEvent>(`/events/${id}/publish`, json("POST"))),
  cancelEvent: async (id: string) =>
    toEvent(await request<ApiEvent>(`/events/${id}/cancel`, json("POST"))),
  archiveEvent: async (id: string) =>
    toEvent(await request<ApiEvent>(`/events/${id}/archive`, json("POST"))),
  register: (eventId: string, members: string[], teamName?: string) =>
    request<{
      registration: Record<string, unknown>;
      ticket: { credential: string };
    }>(
      `/events/${eventId}/register`,
      json("POST", { members, ...(teamName ? { teamName } : {}) }),
    ),
  registrations: () => request<ApiRegistration[]>("/registrations/me"),
  eventRegistrations: (eventId: string) =>
    request<ApiRegistration[]>(`/events/${eventId}/registrations`),
  tickets: () => request<ApiTicket[]>("/tickets/me"),
  myTicketDetails: async () => {
    const [tickets, registrations] = await Promise.all([
      request<ApiTicket[]>("/tickets/me"),
      request<ApiRegistration[]>("/registrations/me"),
    ]);
    const byId = new Map(
      registrations.map((registration) => [registration._id, registration]),
    );
    return Promise.all(
      tickets.map(async (ticket) => {
        const registration = byId.get(ticket.registrationId);
        if (!registration) return null;
        return {
          ticket,
          registration,
          event: await api.event(registration.eventId),
        };
      }),
    ).then((rows) =>
      rows.filter((row): row is NonNullable<typeof row> => row !== null),
    );
  },
  cancelRegistration: (id: string) =>
    request(`/registrations/${id}/cancel`, json("POST")),
  verifyTicket: (credential: string) =>
    request<{
      status: "valid_entry" | "duplicate" | "invalid";
      ticketId?: string;
      participant?: {
        name: string;
        teamName: string | null;
        eventName: string;
      };
    }>("/scans/verify", json("POST", { credential })),
  scans: async () =>
    (await request<ApiScan[]>("/volunteers/me/scans")).map((scan) => ({
      id: scan._id,
      ticketId: scan.ticketId || "—",
      scannedBy: scan.volunteerId,
      scannedAt: scan.scannedAt,
      participantName: scan.participantName,
      teamName: scan.teamName,
      eventName: scan.eventName,
      status:
        scan.status === "valid_entry"
          ? "valid_entry"
          : scan.status === "already_scanned"
            ? "duplicate"
            : "invalid",
    })),
  volunteerSummary: () =>
    request<{
      todayCheckIns: number;
      todayScans: number;
      totalCheckIns: number;
      recent: {
        id: string;
        scannedAt: string;
        status: string;
        participantName: string;
        teamName: string;
        eventName: string;
      }[];
    }>("/volunteers/me/summary"),
  volunteers: async () =>
    (await request<ApiVolunteer[]>("/volunteers")).map(toVolunteer),
  createVolunteer: async (email: string, password: string) => {
    const volunteer = await request<ApiVolunteer>(
      "/volunteers",
      json("POST", { email, name: displayName(email), password }),
    );
    return { volunteer: toVolunteer(volunteer), password };
  },
  setVolunteerStatus: (id: string, status: Volunteer["status"]) =>
    request(
      `/volunteers/${id}/status`,
      json("PATCH", { active: status === "active" }),
    ),
  notices: async () =>
    (await request<ApiNotice[]>("/notifications")).map((notice) => ({
      id: notice._id,
      type: notice.type,
      title: notice.title,
      message: notice.message,
      timestamp: notice.createdAt,
      isRead: notice.isRead,
    })),
  subscribeNotifications: (onNotice: (notice: Notice) => void) => {
    if (!accessToken)
      throw new Error("Sign in before subscribing to notifications");
    const socket = io(new URL(baseUrl).origin, {
      auth: { token: accessToken },
    });
    socket.on("notification:new", (row: ApiNotice) =>
      onNotice({
        id: row._id,
        type: row.type,
        title: row.title,
        message: row.message,
        timestamp: row.createdAt,
        isRead: row.isRead,
      }),
    );
    return () => socket.disconnect();
  },
  markNoticeRead: (id: string) =>
    request(`/notifications/${id}/read`, json("PATCH")),
  announce: (
    title: string,
    message: string,
    audience: "students" | "volunteers" | "all",
  ) =>
    request<{ delivered: number }>(
      "/notifications",
      json("POST", { title, message, audience }),
    ),
  dashboard: () => request<ApiDashboard>("/admin/dashboard"),
  participants: (
    filters: {
      page?: number;
      limit?: number;
      status?: string;
      eventId?: string;
    } = {},
  ) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value !== undefined && value !== "") query.set(key, String(value));
    return request<ApiRegistration[]>(
      `/registrations${query.size ? `?${query}` : ""}`,
    );
  },
  festDates: () => request<ApiFestDates | null>("/fest/dates"),
  saveFestDates: (value: FestDatesDraft) =>
    request<ApiFestDates>("/fest/dates", json("PUT", value)),
  quizzes: () => request<ApiQuiz[]>("/quizzes"),
  createQuiz: (value: {
    eventId: string;
    title: string;
    durationSeconds: number;
    status?: "draft" | "published";
    questions: { text: string; options: string[]; correctAnswer: number }[];
  }) => request<ApiQuiz>("/quizzes", json("POST", value)),
  updateQuiz: (
    id: string,
    value: Partial<{
      eventId: string;
      title: string;
      durationSeconds: number;
      questions: { text: string; options: string[]; correctAnswer: number }[];
    }>,
  ) => request<ApiQuiz>(`/quizzes/${id}`, json("PATCH", value)),
  publishQuiz: (id: string) =>
    request<ApiQuiz>(`/quizzes/${id}/publish`, json("POST")),
  closeQuiz: (id: string) =>
    request<{ id: string; status: string }>(
      `/quizzes/${id}/close`,
      json("POST"),
    ),
  adminQuizzes: () => request<ApiAdminQuiz[]>("/quizzes/admin/list"),
  quizResultsSummary: (id: string) =>
    request<ApiQuizResultsSummary>(`/quizzes/${id}/results/summary`),
  quizResultRows: (id: string) =>
    request<ApiQuizResultRow[]>(`/quizzes/${id}/results/rows`),
  publishQuizResults: (id: string) =>
    request<{ alreadyPublished: boolean; resultsPublishedAt: string }>(
      `/quizzes/${id}/results/publish`,
      json("POST"),
    ),
  announceQuizResults: (id: string) =>
    request<{ delivered: number; alreadyAnnounced: boolean }>(
      `/quizzes/${id}/results/announce`,
      json("POST"),
    ),
  endQuizEarly: (id: string) =>
    request<unknown>(`/quizzes/${id}/end-early`, json("POST")),
  retryQuizFinalization: (id: string) =>
    request<{ finalizedAttempts: number; pendingAttempts: number }>(
      `/quizzes/${id}/finalize/retry`,
      json("POST"),
    ),
  myQuizResult: (id: string) =>
    request<ApiQuizResult>(`/quizzes/${id}/my-result`),
  startQuiz: (id: string) =>
    request<ApiAttemptSnapshot>(`/quizzes/${id}/start`, json("POST")),
  attemptState: (attemptId: string) =>
    request<ApiAttemptSnapshot>(`/quiz-attempts/${attemptId}/state`),
  saveAttemptAnswer: (
    attemptId: string,
    index: number,
    answer: number | null,
  ) =>
    request<{
      index: number;
      accepted: boolean;
      status: string;
      locked: boolean;
      reason?: string;
    }>(`/quiz-attempts/${attemptId}/answers`, json("POST", { index, answer })),
  finishAttempt: (attemptId: string) =>
    request<{
      completed: boolean;
      alreadyCompleted: boolean;
      scoreRevealed: boolean;
      submittedAt: string | null;
    }>(`/quiz-attempts/${attemptId}/finalize`, json("POST")),
  submitQuiz: (id: string, answers: (number | null)[]) =>
    request<{
      score: number;
      total: number;
      timedOut: boolean;
      scoreRevealed: boolean;
    }>(`/quiz-attempts/${id}/submit`, json("POST", { answers })),
  leaderboard: (id: string) =>
    request<
      { rank: number; userName: string; score: number; submittedAt: string }[]
    >(`/quizzes/${id}/leaderboard`),
  certificateTemplates: () =>
    request<ApiCertificateTemplate[]>("/certificates/templates"),
  createCertificateTemplate: (
    value: Omit<ApiCertificateTemplate, "_id" | "status" | "createdAt">,
  ) =>
    request<ApiCertificateTemplate>(
      "/certificates/templates",
      json("POST", value),
    ),
  updateCertificateTemplate: (
    id: string,
    value: Omit<ApiCertificateTemplate, "_id" | "status" | "createdAt">,
  ) =>
    request<ApiCertificateTemplate>(
      `/certificates/templates/${id}`,
      json("PATCH", value),
    ),
  publishCertificates: (templateId: string) =>
    request<{ published: number }>(
      "/certificates/publish",
      json("POST", { templateId }),
    ),
  myCertificates: () => request<ApiCertificate[]>("/certificates/me"),
  verifyCertificate: (certificateId: string) =>
    request<{
      certificateId: string;
      issuedAt: string;
      template: { _id: string; title: string; eventId: string };
    }>(`/certificates/verify/${encodeURIComponent(certificateId)}`),
  /** Downloads a real PDF (ownership + publication enforced server-side). */
  downloadCertificate: async (certificateDocId: string) => {
    const response = await fetch(
      `${baseUrl}/certificates/${certificateDocId}/download`,
      {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
      },
    );
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: { message?: string };
        message?: string;
      } | null;
      throw new Error(
        result?.error?.message ||
          result?.message ||
          `Request failed (${response.status})`,
      );
    }
    return response.blob();
  },
};

export type EventDraft = {
  title: string;
  description: string;
  category: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  teamMin: number;
  teamMax: number;
  image?: string;
  imagePublicId?: string;
};
export type ApiRegistration = {
  _id: string;
  eventId: string;
  userId: string | { name: string; email: string };
  teamName?: string;
  members: string[];
  createdAt: string;
  status: string;
};
export type ApiFestDates = {
  title: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  venue: string | null;
  updatedAt: string | null;
};
export type FestDatesDraft = {
  title?: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  venue?: string;
};
export type ApiAdminQuiz = {
  id: string;
  title: string;
  eventTitle: string;
  status: "draft" | "published" | "closed";
  endsAt: string | null;
  resultsPublishedAt: string | null;
  resultsAnnouncedAt: string | null;
  startedAttempts: number;
  submittedAttempts: number;
  pendingEvaluations: number;
};
export type ApiQuizResultsSummary = {
  id: string;
  title: string;
  eventTitle: string;
  status: "draft" | "published" | "closed";
  endsAt: string | null;
  resultsPublishedAt: string | null;
  resultsAnnouncedAt: string | null;
  participants: number;
  startedAttempts: number;
  submittedAttempts: number;
  pendingEvaluations: number;
};
export type ApiQuizResultRow = {
  rank: number;
  userName: string;
  score: number;
  total: number;
  submittedAt: string;
  timeTakenSeconds: number | null;
};
export type ApiQuizResult = {
  quizId: string;
  title: string;
  score: number;
  total: number;
  rank: number;
  submittedAt: string;
  completedAt: string;
  timeTakenSeconds: number | null;
  resultsPublishedAt: string;
};
export type ApiAttemptSnapshot = {
  attemptId: string;
  /** Only present on the initial start/resume payload. */
  resumed?: boolean;
  endedByAdmin?: boolean;
  /** Only present on the /state snapshot payload. */
  status?: "in_progress" | "completed";
  serverTime: string;
  overallDeadline: string | null;
  questionDeadlines: (string | null)[];
  answers: number[];
  finalizedAt: (string | null)[];
  submittedAt?: string | null;
  scoreRevealed?: boolean;
  quiz: {
    id?: string;
    eventId?: string;
    title: string;
    durationSeconds: number;
    questions: { id: string; text: string; options: string[] }[];
  };
};
export type ApiCertificate = {
  _id: string;
  certificateId: string;
  templateId:
    | string
    | {
        _id: string;
        title: string;
        description?: string;
        eventId: string;
        signatureName?: string;
        signatureRole?: string;
      };
  issuedAt: string;
};
export type ApiDashboard = {
  students: number;
  users: number;
  activeVolunteers: number;
  totalEvents: number;
  events: number;
  upcomingEvents: number;
  registrations: number;
  teamRegistrations: number;
  checkIns: number;
  quizParticipants: number;
  publishedCertificates: number;
  topEvents: {
    id: string;
    title: string;
    category: string;
    capacity: number;
    startsAt: string;
    registrations: number;
  }[];
  registrationsByDay: { date: string; registrations: number }[];
};
export type ApiTicket = {
  _id: string;
  registrationId: string;
  status: string;
  credential: string;
};
type ApiScan = {
  _id: string;
  ticketId?: string;
  volunteerId: string;
  scannedAt: string;
  participantName?: string;
  teamName?: string;
  eventName?: string;
  status:
    | Scan["status"]
    | "already_scanned"
    | "invalid_ticket"
    | "cancelled_ticket"
    | "wrong_event";
};
type ApiVolunteer = {
  _id?: string;
  id?: string;
  email: string;
  name?: string;
  active: boolean;
  createdAt: string;
};
type ApiNotice = {
  _id: string;
  type: Notice["type"];
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};
export type ApiQuiz = {
  _id: string;
  eventId: string;
  title: string;
  durationSeconds: number;
  status: "draft" | "published" | "closed";
  /** Window end for published quizzes (per-quiz or fest-wide). */
  endsAt?: string | null;
  /** Set once admin publishes results; scores stay hidden before this. */
  resultsPublishedAt?: string | null;
  questions: {
    id: string;
    text: string;
    options: string[];
    correctAnswer?: number;
  }[];
};
export type ApiCertificateTemplate = {
  _id: string;
  title: string;
  description: string;
  eventId: string;
  signatureName: string;
  signatureRole: string;
  status: "draft" | "published";
  createdAt: string;
};

function toEvent(event: ApiEvent): Event {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const status = ["draft", "cancelled", "archived"].includes(event.status)
    ? (event.status as Event["status"])
    : end < new Date()
      ? "ended"
      : start <= new Date()
        ? "live"
        : "upcoming";
  return {
    id: event._id,
    title: event.title,
    description: event.description,
    date: event.startsAt.slice(0, 10),
    time: start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    venue: event.venue,
    category: event.category,
    status,
    maxParticipants: event.capacity,
    registered: event.registeredCount,
    image: event.image || "",
    imagePublicId: event.imagePublicId || "",
  };
}

function toVolunteer(volunteer: ApiVolunteer): Volunteer {
  return {
    id: volunteer.id || volunteer._id || "",
    email: volunteer.email,
    status: volunteer.active ? "active" : "inactive",
    createdAt: volunteer.createdAt,
  };
}

function displayName(email: string) {
  return (
    email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Volunteer"
  );
}

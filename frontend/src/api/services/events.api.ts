import { request, json } from "../client";
import { toEvent } from "../mappers";
import type { ApiEvent, UploadedEventImage, EventDraft } from "../types";

export const eventsApi = {
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

  uploadEventImage: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return request<UploadedEventImage>("/events/images", {
      method: "POST",
      body: form,
    });
  },

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
};

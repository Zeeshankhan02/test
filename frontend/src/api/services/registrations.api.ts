import { request, json } from "../client";
import type { ApiRegistration } from "../types";

export const registrationsApi = {
  register: (
    eventId: string,
    participationType: "individual" | "team",
    teamName?: string,
    memberEmails?: string[],
  ) =>
    request<{
      registration: Record<string, unknown>;
      ticket: { credential: string };
    }>(
      `/events/${eventId}/register`,
      json("POST", {
        participationType,
        ...(teamName ? { teamName } : {}),
        ...(memberEmails ? { memberEmails } : {}),
      }),
    ),

  registrations: () => request<ApiRegistration[]>("/registrations/me"),

  eventRegistrations: (eventId: string) =>
    request<ApiRegistration[]>(`/events/${eventId}/registrations`),

  cancelRegistration: (id: string) =>
    request(`/registrations/${id}/cancel`, json("POST")),
};

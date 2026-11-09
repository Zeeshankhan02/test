import { request } from "../client";
import { toEvent } from "../mappers";
import type { ApiTicket } from "../types";

export const ticketsApi = {
  tickets: () => request<ApiTicket[]>("/tickets/me"),

  myTicketDetails: async () =>
    (await request<ApiTicket[]>("/tickets/me")).map((ticket) => ({
      ticket,
      registration: ticket.registration,
      event: ticket.event ? toEvent(ticket.event) : null,
    })),
};

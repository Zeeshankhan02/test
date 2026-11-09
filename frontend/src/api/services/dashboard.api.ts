import { request } from "../client";
import type { ApiRegistration, ApiDashboard } from "../types";

export const dashboardApi = {
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
};

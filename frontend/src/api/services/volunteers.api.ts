import { request, json } from "../client";
import { toVolunteer, displayName } from "../mappers";
import type { ApiVolunteer } from "../types";
import type { Volunteer } from "../../types";

export const volunteersApi = {
  volunteers: async () =>
    (await request<ApiVolunteer[]>("/volunteers")).map(toVolunteer),

  createVolunteer: async (email: string) => {
    const created = await request<{
      volunteer: ApiVolunteer;
      password: string;
    }>("/volunteers", json("POST", { email, name: displayName(email) }));
    return {
      volunteer: toVolunteer(created.volunteer),
      password: created.password,
    };
  },

  setVolunteerStatus: (id: string, status: Volunteer["status"]) =>
    request(
      `/volunteers/${id}/status`,
      json("PATCH", { active: status === "active" }),
    ),
};

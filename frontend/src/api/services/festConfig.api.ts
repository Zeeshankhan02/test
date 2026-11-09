import { request, json } from "../client";
import type { ApiFestDates, FestDatesDraft } from "../types";
import { setFestDatesCache } from "../festDatesCache";

export const festConfigApi = {
  festDates: () => request<ApiFestDates | null>("/fest/dates"),

  saveFestDates: async (value: FestDatesDraft) => {
    const dates = await request<ApiFestDates>(
      "/fest/dates",
      json("PUT", {
        ...value,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    );
    setFestDatesCache(dates);
    return dates;
  },
};

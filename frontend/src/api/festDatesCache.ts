import type { ApiFestDates } from "./types";

let datesCache: ApiFestDates | null | undefined;
const listeners = new Set<(dates: ApiFestDates | null) => void>();

export const getFestDatesCache = () => datesCache;

export function setFestDatesCache(dates: ApiFestDates | null) {
  datesCache = dates;
  listeners.forEach((listener) => listener(dates));
}

export function subscribeFestDatesCache(
  listener: (dates: ApiFestDates | null) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

import { useEffect, useState } from "react";
import { api } from "../../api";
import type { Event } from "../../types";

export function useEvents() {
  const [items, setItems] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true);
    void api
      .events()
      .then(setItems)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load events.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  return { items, loading, error, reload: load };
}

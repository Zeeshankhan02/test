import type { ApiUser, Envelope } from "./types";

export const baseUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1"
).replace(/\/$/, "");

let accessToken: string | null = null;
let refreshPromise: Promise<{
  accessToken: string;
  user: ApiUser;
} | null> | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

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

export async function raw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string" && !headers.has("Content-Type"))
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
        setAccessToken(session.accessToken);
        return session;
      } catch {
        setAccessToken(null);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function request<T>(
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

export const json = (method: string, value?: unknown): RequestInit => ({
  method,
  ...(value === undefined ? {} : { body: JSON.stringify(value) }),
});

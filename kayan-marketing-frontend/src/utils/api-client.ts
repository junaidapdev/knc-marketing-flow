import { supabase } from "../lib/supabase";
import { env } from "../config/env";
import { logger } from "./logger";

interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiError {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  searchParams?: Record<string, string | number | undefined>;
}

// Resolve a usable session — if the cached one is expired or near-expiry,
// force a refresh. supabase-js does this on `getSession()` when the access
// token is past expiry, but we add a safety margin so requests don't go out
// with a token that expires mid-flight.
async function getFreshSession(): Promise<{ access_token: string } | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  // If less than 60s of life left, refresh proactively.
  if (expiresAt - nowSec < 60) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session) return null;
    return { access_token: refreshed.session.access_token };
  }
  return { access_token: session.access_token };
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { method = "GET", body, searchParams } = options;

  const session = await getFreshSession();
  if (!session) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated." } };
  }

  const url = new URL(`${env.VITE_API_BASE_URL}/functions/v1${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const sendOnce = async (token: string): Promise<Response> =>
    fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  try {
    let response = await sendOnce(session.access_token);

    // If the backend rejects the token (expired between getSession() and
    // network arrival), force a refresh and retry exactly once before
    // surfacing the error.
    if (response.status === 401) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      const newToken = refreshed.session?.access_token;
      if (newToken) {
        response = await sendOnce(newToken);
      }
    }

    // 204 No Content (e.g., DELETE) — no body to parse
    if (response.status === 204) {
      return { success: true, data: null as T };
    }

    const json = (await response.json()) as ApiResponse<T>;
    return json;
  } catch (err) {
    logger.error("api request failed", { path, err: String(err) });
    return { success: false, error: { code: "INTERNAL_ERROR", message: "Network error." } };
  }
}

import { corsHeaders } from "./cors.ts";

interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function jsonSuccess<T>(
  data: T,
  status = 200,
  meta?: Record<string, unknown>,
): Response {
  const body: ApiSuccess<T> = { success: true, data, ...(meta ? { meta } : {}) };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  const body: ApiError = {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

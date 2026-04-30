import { ERROR_MESSAGES, type ErrorCode } from "../constants/errors";
import type { ApiSuccessResponse, ApiErrorResponse } from "../types/api-response";

export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
): ApiSuccessResponse<T> {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

export function errorResponse(
  code: ErrorCode,
  customMessage?: string,
  details?: Record<string, unknown>,
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message: customMessage ?? ERROR_MESSAGES[code],
      ...(details ? { details } : {}),
    },
  };
}

import { z } from "zod";
import { ERROR_CODES } from "../constants/errors";
import { errorResponse } from "./api-response";
import type { ApiErrorResponse } from "../types/api-response";

interface ValidationSuccess<T> {
  success: true;
  data: T;
}

interface ValidationFailure {
  success: false;
  response: ApiErrorResponse;
}

export function validate<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
): ValidationSuccess<T> | ValidationFailure {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    response: errorResponse(ERROR_CODES.VALIDATION_FAILED, "Request validation failed.", {
      fieldErrors: result.error.flatten().fieldErrors,
    }),
  };
}

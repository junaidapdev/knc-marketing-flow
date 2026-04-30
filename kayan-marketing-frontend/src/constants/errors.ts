export const ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  NETWORK_ERROR: "NETWORK_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export const ERROR_MESSAGES = {
  [ERROR_CODES.VALIDATION_FAILED]: "Request validation failed.",
  [ERROR_CODES.UNAUTHORIZED]: "Authentication required.",
  [ERROR_CODES.FORBIDDEN]: "You do not have permission to perform this action.",
  [ERROR_CODES.NOT_FOUND]: "The requested resource was not found.",
  [ERROR_CODES.CONFLICT]: "The request conflicts with the current state.",
  [ERROR_CODES.NETWORK_ERROR]: "A network error occurred. Please try again.",
  [ERROR_CODES.INTERNAL_ERROR]: "An unexpected error occurred.",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

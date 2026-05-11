export const REPORT_GRANULARITY = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  CUSTOM: "custom",
} as const;

export type ReportGranularity =
  (typeof REPORT_GRANULARITY)[keyof typeof REPORT_GRANULARITY];

export const PERFORMANCE_COVERAGE_THRESHOLD = 50;
export const REPORT_CACHE_TTL_SECONDS = 300;
export const REPORT_MAX_RANGE_DAYS = 365;

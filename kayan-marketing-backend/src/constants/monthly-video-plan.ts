// Field bounds for monthly video plan items.
export const MONTHLY_VIDEO_PLAN_LABEL_MAX_LENGTH = 120;
export const MONTHLY_VIDEO_PLAN_COUNT_MIN = 1;
export const MONTHLY_VIDEO_PLAN_COUNT_MAX = 999;

// Gap between auto-assigned sort_order values on insert. Leaves room for
// future drag-to-reorder without rewriting every row.
export const MONTHLY_VIDEO_PLAN_SORT_GAP = 10;

// Date string shape for the month column (always first-of-month, YYYY-MM-DD).
export const MONTHLY_VIDEO_PLAN_MONTH_DATE_REGEX = /^\d{4}-\d{2}-01$/;

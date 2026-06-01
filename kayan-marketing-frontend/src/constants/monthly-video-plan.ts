// Field bounds mirrored from the backend.
export const MONTHLY_VIDEO_PLAN_LABEL_MAX_LENGTH = 120;
export const MONTHLY_VIDEO_PLAN_COUNT_MIN = 1;
export const MONTHLY_VIDEO_PLAN_COUNT_MAX = 999;

export const MONTHLY_VIDEO_PLAN_COPY = {
  pageTitle: "Goals",
  pageSubtitle: "Monthly video plan",
  totalSingleLabel: "videos planned",
  emptyHeading: "No plan yet for this month",
  emptyHint:
    "Add line items below — each one is a bucket of videos you want to ship.",
  copyFromPreviousButton: "Copy from previous month",
  copyFromPreviousHint:
    "Start with last month's plan and tweak.",
  copySuccessMessage: "Items copied from previous month.",
  copyEmptyMessage: "Previous month had no items to copy.",
  addRowLabel: "Add a line item",
  addRowCountPlaceholder: "Count",
  addRowMaxPlaceholder: "Max (optional)",
  addRowLabelPlaceholder: "e.g. Money challenge videos",
  addRowButton: "Add",
  itemEditLabel: "Edit",
  itemDeleteLabel: "Delete",
  itemSaveLabel: "Save",
  itemCancelLabel: "Cancel",
  rangeJoiner: "–",
  countSuffix: "videos",
  deleteConfirmTitle: "Delete this line item?",
  deleteConfirmBody: "This can't be undone, but you can add it again.",
  deleteConfirmConfirm: "Delete",
  deleteConfirmCancel: "Cancel",
  errorLoadingHeading: "Couldn't load this month's plan",
  errorFallbackMessage: "Something went wrong. Try again in a moment.",
  retryButton: "Retry",
} as const;

// Month-cursor format (first-of-month YYYY-MM-DD).
export const MONTHLY_VIDEO_PLAN_MONTH_FORMAT = "yyyy-MM-01";
// Label shown above the picker.
export const MONTHLY_VIDEO_PLAN_MONTH_LABEL_FORMAT = "MMMM yyyy";

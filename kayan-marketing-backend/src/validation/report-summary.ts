import { z } from "zod";
import { REPORT_MAX_RANGE_DAYS } from "../constants/report-periods";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function parseDate(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function isValidIsoDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const dateParam = z
  .string()
  .regex(DATE_RE, "Must be YYYY-MM-DD.")
  .refine(isValidIsoDate, "Must be a valid calendar date.");

const booleanQueryParam = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().default(false));

export const reportSummaryQuerySchema = z
  .object({
    from: dateParam,
    to: dateParam,
    compareToPrevious: booleanQueryParam,
    campaignId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    const fromMs = parseDate(data.from);
    const toMs = parseDate(data.to);

    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return;

    if (toMs < fromMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "End date must be on or after start date.",
      });
      return;
    }

    const daysCount = Math.floor((toMs - fromMs) / MS_PER_DAY) + 1;
    if (daysCount > REPORT_MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "Report range cannot exceed 365 days.",
      });
    }
  });

export type ReportSummaryQuery = z.infer<typeof reportSummaryQuerySchema>;

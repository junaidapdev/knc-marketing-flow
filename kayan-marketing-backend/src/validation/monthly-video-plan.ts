import { z } from "zod";
import {
  MONTHLY_VIDEO_PLAN_COUNT_MAX,
  MONTHLY_VIDEO_PLAN_COUNT_MIN,
  MONTHLY_VIDEO_PLAN_LABEL_MAX_LENGTH,
  MONTHLY_VIDEO_PLAN_MONTH_DATE_REGEX,
} from "../constants/monthly-video-plan";

const labelSchema = z
  .string()
  .trim()
  .min(1, "Label is required.")
  .max(MONTHLY_VIDEO_PLAN_LABEL_MAX_LENGTH, "Label is too long.");

const countSchema = z
  .number()
  .int()
  .min(MONTHLY_VIDEO_PLAN_COUNT_MIN)
  .max(MONTHLY_VIDEO_PLAN_COUNT_MAX);

const countMaxSchema = z
  .number()
  .int()
  .min(MONTHLY_VIDEO_PLAN_COUNT_MIN)
  .max(MONTHLY_VIDEO_PLAN_COUNT_MAX)
  .nullable();

export const monthlyVideoPlanCreateSchema = z
  .object({
    brandId: z.string().uuid(),
    month: z.string().regex(MONTHLY_VIDEO_PLAN_MONTH_DATE_REGEX),
    label: labelSchema,
    count: countSchema,
    countMax: countMaxSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.countMax != null && data.countMax < data.count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["countMax"],
        message: "Max count must be >= count.",
      });
    }
  });

export const monthlyVideoPlanUpdateSchema = z
  .object({
    label: labelSchema.optional(),
    count: countSchema.optional(),
    countMax: countMaxSchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.countMax != null &&
      data.count != null &&
      data.countMax < data.count
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["countMax"],
        message: "Max count must be >= count.",
      });
    }
  });

export const monthlyVideoPlanCopySchema = z.object({
  brandId: z.string().uuid(),
  targetMonth: z.string().regex(MONTHLY_VIDEO_PLAN_MONTH_DATE_REGEX),
  sourceMonth: z.string().regex(MONTHLY_VIDEO_PLAN_MONTH_DATE_REGEX),
});

export type MonthlyVideoPlanCreateInput = z.infer<
  typeof monthlyVideoPlanCreateSchema
>;
export type MonthlyVideoPlanUpdateInput = z.infer<
  typeof monthlyVideoPlanUpdateSchema
>;
export type MonthlyVideoPlanCopyInput = z.infer<
  typeof monthlyVideoPlanCopySchema
>;

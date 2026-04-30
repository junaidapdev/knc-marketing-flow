import { z } from "zod";

const BUDGET_CATEGORY_VALUES = [
  "ad_spend_tiktok",
  "ad_spend_snap",
  "ad_spend_ig",
  "influencer",
  "shop_materials",
  "production",
  "other",
] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const categoryCapsSchema = z
  .record(z.enum(BUDGET_CATEGORY_VALUES), z.number().nonnegative())
  .optional();

export const createBudgetCapSchema = z.object({
  brandId: z.string().uuid(),
  month: z.string().regex(DATE_REGEX, "Must be YYYY-MM-DD (use first of month)"),
  totalCap: z.number().positive(),
  categoryCaps: categoryCapsSchema,
  notes: z.string().max(5000).nullable().optional(),
});

export const updateBudgetCapSchema = z.object({
  totalCap: z.number().positive().optional(),
  categoryCaps: categoryCapsSchema,
  notes: z.string().max(5000).nullable().optional(),
});

export type CreateBudgetCapInput = z.infer<typeof createBudgetCapSchema>;
export type UpdateBudgetCapInput = z.infer<typeof updateBudgetCapSchema>;

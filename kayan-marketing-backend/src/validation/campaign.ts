import { z } from "zod";

const CAMPAIGN_TYPE_VALUES = [
  "offer",
  "event",
  "reward",
  "seasonal",
  "awareness",
  "other",
] as const;
const CAMPAIGN_STATUS_VALUES = ["planned", "active", "completed", "cancelled"] as const;
const ASSIGNEE_VALUES = ["junaid", "ammar"] as const;
const ROLLOUT_STATUS_VALUES = ["planned", "active", "done", "skipped"] as const;
const AD_PLATFORM_VALUES = ["tiktok", "snapchat", "instagram"] as const;
const AD_OBJECTIVE_VALUES = ["awareness", "conversion", "traffic"] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createCampaignSchema = z
  .object({
    brandId: z.string().uuid(),
    name: z.string().min(3).max(200),
    campaignType: z.enum(CAMPAIGN_TYPE_VALUES),
    startDate: z.string().regex(DATE_REGEX, "Must be YYYY-MM-DD"),
    endDate: z.string().regex(DATE_REGEX, "Must be YYYY-MM-DD"),
    totalBudget: z.number().nonnegative().default(0),
    offerTrigger: z.string().max(500).nullable().optional(),
    offerReward: z.string().max(500).nullable().optional(),
    promoCode: z.string().max(50).nullable().optional(),
    customFields: z.record(z.unknown()).optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate.",
    path: ["endDate"],
  });

export const updateCampaignSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  campaignType: z.enum(CAMPAIGN_TYPE_VALUES).optional(),
  status: z.enum(CAMPAIGN_STATUS_VALUES).optional(),
  startDate: z.string().regex(DATE_REGEX).optional(),
  endDate: z.string().regex(DATE_REGEX).optional(),
  totalBudget: z.number().nonnegative().optional(),
  totalSpent: z.number().nonnegative().optional(),
  offerTrigger: z.string().max(500).nullable().optional(),
  offerReward: z.string().max(500).nullable().optional(),
  promoCode: z.string().max(50).nullable().optional(),
  customFields: z.record(z.unknown()).optional(),
  results: z.record(z.unknown()).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const createBranchRolloutSchema = z.object({
  campaignId: z.string().uuid(),
  branchId: z.string().uuid(),
  rolloutDate: z.string().regex(DATE_REGEX, "Must be YYYY-MM-DD"),
  leadAssignee: z.enum(ASSIGNEE_VALUES),
  calendarEntryId: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const updateBranchRolloutSchema = z.object({
  rolloutDate: z.string().regex(DATE_REGEX).optional(),
  leadAssignee: z.enum(ASSIGNEE_VALUES).optional(),
  status: z.enum(ROLLOUT_STATUS_VALUES).optional(),
  calendarEntryId: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const createAdSpendSchema = z
  .object({
    campaignId: z.string().uuid(),
    platform: z.enum(AD_PLATFORM_VALUES),
    startDate: z.string().regex(DATE_REGEX),
    endDate: z.string().regex(DATE_REGEX),
    budget: z.number().nonnegative().default(0),
    objective: z.enum(AD_OBJECTIVE_VALUES).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate.",
    path: ["endDate"],
  });

export const updateAdSpendSchema = z.object({
  spent: z.number().nonnegative().optional(),
  impressions: z.number().int().nonnegative().nullable().optional(),
  clicks: z.number().int().nonnegative().nullable().optional(),
  conversions: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CreateBranchRolloutInput = z.infer<typeof createBranchRolloutSchema>;
export type UpdateBranchRolloutInput = z.infer<typeof updateBranchRolloutSchema>;
export type CreateAdSpendInput = z.infer<typeof createAdSpendSchema>;
export type UpdateAdSpendInput = z.infer<typeof updateAdSpendSchema>;

import { z } from "zod";

const ENTRY_TYPE_VALUES = [
  "tiktok_video",
  "instagram_reel",
  "instagram_story",
  "snapchat_story",
  "shop_activity",
  "influencer_collab",
  "offer",
  "general",
] as const;

const ASSIGNEE_VALUES = ["junaid", "ammar"] as const;
const ENTRY_STATUS_VALUES = ["planned", "in_progress", "live", "done", "cancelled"] as const;
const BUDGET_CATEGORY_VALUES = [
  "ad_spend_tiktok",
  "ad_spend_snap",
  "ad_spend_ig",
  "influencer",
  "shop_materials",
  "production",
  "other",
] as const;

const calendarEntryBaseSchema = z.object({
  brandId: z.string().uuid(),
  campaignId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  influencerId: z.string().uuid().nullable().optional(),
  type: z.enum(ENTRY_TYPE_VALUES),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).nullable().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  assignee: z.enum(ASSIGNEE_VALUES),
  budgetAllocated: z.number().nonnegative().default(0),
  budgetCategory: z.enum(BUDGET_CATEGORY_VALUES).nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
  postUrl: z.string().url().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  autoCreateTasks: z.boolean().default(true),
});

export const createCalendarEntrySchema = calendarEntryBaseSchema.superRefine(
  (data, ctx) => {
    if (data.type === "influencer_collab" && !data.influencerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["influencerId"],
        message: "Influencer is required for influencer collaborations.",
      });
    }
  },
);

export const updateCalendarEntrySchema = calendarEntryBaseSchema.partial().extend({
  status: z.enum(ENTRY_STATUS_VALUES).optional(),
  budgetSpent: z.number().nonnegative().optional(),
});

export type CreateCalendarEntryInput = z.infer<typeof createCalendarEntrySchema>;
export type UpdateCalendarEntryInput = z.infer<typeof updateCalendarEntrySchema>;

import { z } from "zod";

// Schemas mirrored from supabase/functions/calendar-entries/index.ts. Kept
// here for shared validation in any future Node-side consumer (CLI tools,
// tests, etc.). Edge Functions inline their own copies to stay independent.

const CONTENT_FORMAT_VALUES = [
  "video",
  "story",
  "shop_activity",
  "influencer_collab",
  "offer",
  "general",
] as const;

const PLATFORM_VALUES = ["tiktok", "instagram", "snapchat"] as const;
const ASSIGNEE_VALUES = ["junaid", "ammar", "both"] as const;
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

const CONTENT_FORMATS = new Set<string>(["video", "story"]);

const calendarEntryBaseSchema = z.object({
  brandId: z.string().uuid(),
  campaignId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  influencerId: z.string().uuid().nullable().optional(),
  format: z.enum(CONTENT_FORMAT_VALUES),
  platforms: z.array(z.enum(PLATFORM_VALUES)).default([]),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).nullable().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  assignee: z.enum(ASSIGNEE_VALUES),
  budgetAllocated: z.number().nonnegative().default(0),
  budgetCategory: z.enum(BUDGET_CATEGORY_VALUES).nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  autoCreateTasks: z.boolean().default(true),
});

export const createCalendarEntrySchema = calendarEntryBaseSchema.superRefine(
  (data, ctx) => {
    if (data.format === "influencer_collab" && !data.influencerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["influencerId"],
        message: "Influencer is required for influencer collaborations.",
      });
    }
    if (CONTENT_FORMATS.has(data.format) && data.platforms.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["platforms"],
        message: "Pick at least one platform for video/story entries.",
      });
    }
    if (!CONTENT_FORMATS.has(data.format) && data.platforms.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["platforms"],
        message: "Platforms only apply to video and story entries.",
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

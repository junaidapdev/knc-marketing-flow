import { z } from "zod";
import { TOPIC_OCCASIONS, TOPIC_STATUSES } from "../constants/topics";

// Mirror of the Edge Function schemas (supabase/functions/topics/index.ts).
// Kept here for any future Node-side consumer; Edge Functions inline their
// own copies so they remain Deno-self-contained.

const CONTENT_FORMAT_VALUES = [
  "video",
  "story",
  "shop_activity",
  "influencer_collab",
  "offer",
  "general",
] as const;

const PLATFORM_VALUES = ["tiktok", "instagram", "snapchat"] as const;
const CONTENT_FORMATS = new Set<string>(["video", "story"]);

// Pattern IDs aren't enum-constrained at the DB level (kept in code for V1).
const patternIdSchema = z
  .string()
  .regex(/^P\d{1,2}$/, "Must be a pattern id like P1, P9, P12")
  .nullable()
  .optional();

// ───────── Create ─────────
export const createTopicSchema = z
  .object({
    brandId: z.string().uuid(),
    title: z.string().min(3).max(200),
    description: z.string().max(2000).nullable().optional(),
    patternId: patternIdSchema,
    branchId: z.string().uuid().nullable().optional(),
    theme: z.string().max(200).nullable().optional(),
    occasion: z.enum(TOPIC_OCCASIONS).nullable().optional(),
    format: z.enum(CONTENT_FORMAT_VALUES),
    defaultPlatforms: z.array(z.enum(PLATFORM_VALUES)).default([]),
    priority: z.number().int().min(0).max(100).default(0),
    notes: z.string().max(5000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (CONTENT_FORMATS.has(data.format) && data.defaultPlatforms.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultPlatforms"],
        message: "Pick at least one platform for video/story topics.",
      });
    }
    if (!CONTENT_FORMATS.has(data.format) && data.defaultPlatforms.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultPlatforms"],
        message: "Platforms only apply to video and story topics.",
      });
    }
  });

// ───────── Update ─────────
export const updateTopicSchema = createTopicSchema.innerType().partial().extend({
  status: z.enum(TOPIC_STATUSES).optional(),
});

// ───────── Use ─────────
export const useTopicSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  assignee: z.enum(["junaid", "ammar", "both"]),
  shootDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .nullable()
    .optional(),
  branchId: z.string().uuid().nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  platformsOverride: z.array(z.enum(PLATFORM_VALUES)).optional(),
  titleOverride: z.string().min(3).max(200).optional(),
  descriptionOverride: z.string().max(2000).nullable().optional(),
  productionMode: z.enum(["batch", "adhoc"]).default("batch"),
  editorDaysOffset: z.number().int().min(0).max(30).default(2),
  autoCreateTasks: z.boolean().default(true),
});

export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
export type UseTopicInput = z.infer<typeof useTopicSchema>;

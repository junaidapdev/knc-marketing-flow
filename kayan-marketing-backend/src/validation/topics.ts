import { z } from "zod";
import { TOPIC_OCCASIONS, TOPIC_STATUSES } from "../constants/topics";

// Mirror calendar_entries.type CHECK list — kept inline (rather than imported
// from entry-types) so the validation layer stays self-contained and the
// allowed values are obvious here.
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

// Pattern IDs aren't enum-constrained at the DB level (kept in code for V1).
// Validate shape only — anything matching /^P\d{1,2}$/ is accepted.
const patternIdSchema = z
  .string()
  .regex(/^P\d{1,2}$/, "Must be a pattern id like P1, P9, P12")
  .nullable()
  .optional();

// ───────── Create ─────────
// `brandId` is required (single-tenant V1 still passes it through). `title`
// matches the DB CHECK (length >= 3). `priority` is bounded to keep the queue
// sortable without absurd values.
export const createTopicSchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).nullable().optional(),
  patternId: patternIdSchema,
  branchId: z.string().uuid().nullable().optional(),
  theme: z.string().max(200).nullable().optional(),
  occasion: z.enum(TOPIC_OCCASIONS).nullable().optional(),
  entryType: z.enum(ENTRY_TYPE_VALUES),
  priority: z.number().int().min(0).max(100).default(0),
  notes: z.string().max(5000).nullable().optional(),
});

// ───────── Update ─────────
// All-partial except status, which the queue UI flips directly. We don't
// expose used_at / used_for_entry_id here — those flip via the useTopic flow
// (RPC) so the entry + topic stay consistent in one transaction.
export const updateTopicSchema = createTopicSchema.partial().extend({
  status: z.enum(TOPIC_STATUSES).optional(),
});

// ───────── Use ─────────
// "Convert this topic to a calendar entry." The topicId comes from the URL,
// so the body only needs the entry overrides. We accept the bare minimum that
// changes per call — the rest (assignee, branch, type, etc.) is inherited
// from the topic, with these fields acting as overrides at conversion time.
export const useTopicSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  assignee: z.enum(["junaid", "ammar", "both"]),
  shootDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .nullable()
    .optional(),
  // Optional per-call overrides — fall back to the topic's value if omitted.
  branchId: z.string().uuid().nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  titleOverride: z.string().min(3).max(200).optional(),
  descriptionOverride: z.string().max(2000).nullable().optional(),
  productionMode: z.enum(["batch", "adhoc"]).default("batch"),
  editorDaysOffset: z.number().int().min(0).max(30).default(2),
  autoCreateTasks: z.boolean().default(true),
});

export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
export type UseTopicInput = z.infer<typeof useTopicSchema>;

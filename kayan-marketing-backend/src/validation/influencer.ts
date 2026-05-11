import { z } from "zod";
import { INFLUENCER_STATUS } from "../constants/influencer-status";
import { INFLUENCER_NICHE_TAGS } from "../constants/influencer-niche-tags";
import { INFLUENCER_LANGUAGES } from "../constants/influencer-languages";

const STATUS_VALUES = [
  INFLUENCER_STATUS.ACTIVE,
  INFLUENCER_STATUS.PAUSED,
  INFLUENCER_STATUS.BLACKLISTED,
] as const;

const LANGUAGE_VALUES = [
  INFLUENCER_LANGUAGES.ARABIC,
  INFLUENCER_LANGUAGES.ENGLISH,
] as const;

const phoneSchema = z
  .string()
  .trim()
  .min(5)
  .max(40)
  .regex(/^\+?[0-9][0-9\s().-]*$/, "Use a valid WhatsApp phone number.");

const nullableText = z.string().trim().max(500).nullable().optional();
const nullableUrl = z.string().trim().url().nullable().optional();
const followers = z.number().int().nonnegative().nullable().optional();
const handle = z.string().trim().max(120).nullable().optional();

function hasHandle(data: {
  tiktokHandle?: string | null;
  instagramHandle?: string | null;
  snapchatHandle?: string | null;
}): boolean {
  return Boolean(
    data.tiktokHandle?.trim() ||
    data.instagramHandle?.trim() ||
    data.snapchatHandle?.trim(),
  );
}

const baseInfluencerSchema = z.object({
  brandId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(200),
  fullName: nullableText,
  whatsapp: phoneSchema,
  city: nullableText,
  tiktokHandle: handle,
  tiktokUrl: nullableUrl,
  tiktokFollowers: followers,
  instagramHandle: handle,
  instagramUrl: nullableUrl,
  instagramFollowers: followers,
  snapchatHandle: handle,
  snapchatUrl: nullableUrl,
  snapchatFollowers: followers,
  standardRate: z.number().nonnegative().nullable().optional(),
  acceptsBarter: z.boolean().default(false),
  nicheTags: z.array(z.enum(INFLUENCER_NICHE_TAGS)).default([]),
  languages: z.array(z.enum(LANGUAGE_VALUES)).default([]),
  notes: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(STATUS_VALUES).default(INFLUENCER_STATUS.ACTIVE),
});

export const createInfluencerSchema = baseInfluencerSchema.superRefine(
  (data, ctx) => {
    if (!hasHandle(data)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tiktokHandle"],
        message: "Add at least one platform handle.",
      });
    }
  },
);

export const updateInfluencerSchema = baseInfluencerSchema
  .partial()
  .superRefine((data, ctx) => {
    const handleFieldsWereSent =
      data.tiktokHandle !== undefined ||
      data.instagramHandle !== undefined ||
      data.snapchatHandle !== undefined;
    if (
      data.tiktokHandle !== undefined &&
      data.instagramHandle !== undefined &&
      data.snapchatHandle !== undefined &&
      handleFieldsWereSent &&
      !hasHandle(data)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tiktokHandle"],
        message: "Add at least one platform handle.",
      });
    }
  });

export type CreateInfluencerInput = z.infer<typeof createInfluencerSchema>;
export type UpdateInfluencerInput = z.infer<typeof updateInfluencerSchema>;

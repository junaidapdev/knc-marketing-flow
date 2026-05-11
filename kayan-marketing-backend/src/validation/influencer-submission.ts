import { z } from "zod";
import {
  INFLUENCER_PLATFORM,
  INFLUENCER_SUBMISSION_STATUS,
} from "../constants/influencer-submissions";

const platformValues = [
  INFLUENCER_PLATFORM.TIKTOK,
  INFLUENCER_PLATFORM.INSTAGRAM,
  INFLUENCER_PLATFORM.SNAPCHAT,
] as const;

const statusValues = [
  INFLUENCER_SUBMISSION_STATUS.PENDING,
  INFLUENCER_SUBMISSION_STATUS.VERIFIED,
  INFLUENCER_SUBMISSION_STATUS.DISPUTED,
] as const;

const optionalUrl = z.string().trim().url().nullable().optional();
const metric = z.number().int().nonnegative().nullable().optional();

export const createInfluencerSubmissionSchema = z
  .object({
    entryId: z.string().uuid(),
    tiktokPostUrl: optionalUrl,
    instagramPostUrl: optionalUrl,
    snapchatPostUrl: optionalUrl,
    taggedKayan: z.boolean().nullable().optional(),
    usedPromoCode: z.boolean().nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.tiktokPostUrl && !data.instagramPostUrl && !data.snapchatPostUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tiktokPostUrl"],
        message: "Add at least one post URL.",
      });
    }
  });

export const updateInfluencerSubmissionSchema = z.object({
  verificationStatus: z.enum(statusValues),
  disputeReason: z.string().trim().max(2000).nullable().optional(),
});

export const createInfluencerPerformanceLogSchema = z.object({
  submissionId: z.string().uuid(),
  platform: z.enum(platformValues),
  views: metric,
  likes: metric,
  comments: metric,
  shares: metric,
  reach: metric,
  notes: z.string().trim().max(5000).nullable().optional(),
});

export type CreateInfluencerSubmissionInput = z.infer<
  typeof createInfluencerSubmissionSchema
>;
export type UpdateInfluencerSubmissionInput = z.infer<
  typeof updateInfluencerSubmissionSchema
>;
export type CreateInfluencerPerformanceLogInput = z.infer<
  typeof createInfluencerPerformanceLogSchema
>;

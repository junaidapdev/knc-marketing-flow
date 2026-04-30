import { z } from "zod";

const SOCIAL_PLATFORM_VALUES = ["tiktok", "instagram", "snapchat"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createPerformanceSnapshotSchema = z.object({
  brandId: z.string().uuid(),
  snapshotDate: z.string().regex(DATE_REGEX, "Must be YYYY-MM-DD"),
  platform: z.enum(SOCIAL_PLATFORM_VALUES),
  followers: z.number().int().nonnegative().nullable().optional(),
  totalViews: z.number().int().nonnegative().nullable().optional(),
  totalLikes: z.number().int().nonnegative().nullable().optional(),
  totalComments: z.number().int().nonnegative().nullable().optional(),
  totalShares: z.number().int().nonnegative().nullable().optional(),
  reach: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const createTopPostSchema = z.object({
  brandId: z.string().uuid(),
  entryId: z.string().uuid().nullable().optional(),
  platform: z.enum(SOCIAL_PLATFORM_VALUES),
  postDate: z.string().regex(DATE_REGEX, "Must be YYYY-MM-DD"),
  captionSnippet: z.string().max(500).nullable().optional(),
  plays: z.number().int().nonnegative().nullable().optional(),
  likes: z.number().int().nonnegative().nullable().optional(),
  comments: z.number().int().nonnegative().nullable().optional(),
  shares: z.number().int().nonnegative().nullable().optional(),
  engagementRate: z.number().min(0).max(100).nullable().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  postUrl: z.string().url().nullable().optional(),
});

export type CreatePerformanceSnapshotInput = z.infer<typeof createPerformanceSnapshotSchema>;
export type CreateTopPostInput = z.infer<typeof createTopPostSchema>;

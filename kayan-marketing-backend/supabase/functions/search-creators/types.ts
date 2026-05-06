// Zod schema mirroring the frontend's CreatorSearchFilters. Edge Functions
// can't import from src/types/, so this is the single source of truth on
// the backend side. Keep in sync with kayan-marketing-frontend/src/types/
// influencer.ts and src/constants/influencer.ts.

import { z } from "https://esm.sh/zod@3.23.0";

const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
const CATEGORIES = ["dessert", "food", "family", "gifting", "lifestyle"] as const;
const LANGUAGES = ["arabic", "english", "both"] as const;
const COUNTRIES = ["sa", "ae", "kw", "bh", "qa", "om"] as const;
const FREQUENCIES = ["daily", "weekly", "monthly"] as const;
const GENDERS = ["female", "male", "balanced"] as const;

export const filtersSchema = z.object({
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  countries: z.array(z.enum(COUNTRIES)).default([]),
  city: z.string().max(120).optional(),
  ageMin: z.number().int().min(13).max(65).optional(),
  ageMax: z.number().int().min(13).max(65).optional(),
  genderSkew: z.enum(GENDERS).optional(),
  audienceCountries: z.array(z.enum(COUNTRIES)).optional(),
  followerMin: z.number().int().min(0).optional(),
  followerMax: z.number().int().min(0).optional(),
  engagementRateMin: z.number().min(0).max(100).optional(),
  engagementRateMax: z.number().min(0).max(100).optional(),
  avgViewsMin: z.number().int().min(0).optional(),
  avgLikesMin: z.number().int().min(0).optional(),
  postingFrequency: z.enum(FREQUENCIES).optional(),
  categories: z.array(z.enum(CATEGORIES)).default([]),
  language: z.enum(LANGUAGES).optional(),
});

export type CreatorSearchFilters = z.infer<typeof filtersSchema>;

export type Platform = (typeof PLATFORMS)[number];

// Shape of a creator_results row insert, snake_case to match the table
// columns directly. The Edge Function inserts these and reads back the
// stored rows (server-generated id + created_at) for the response.
export interface NormalizedCreator {
  search_id: string;
  platform: Platform;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  engagement_rate: number | null;
  language: "arabic" | "english" | "both" | null;
  country: string | null;
  city: string | null;
  audience_demographics: Record<string, unknown>;
  raw: Record<string, unknown>;
  is_estimated_demographics: boolean;
  // Populated by the Chunk 5 scoring pass after merge + dedupe + cap. The
  // platform normalizers leave them undefined so the score module is the
  // sole writer.
  fit_score?: number | null;
  fit_rationale?: string | null;
}

export interface PlatformHandler {
  buildInput: (filters: CreatorSearchFilters) => unknown;
  normalize: (items: unknown[], searchId: string) => NormalizedCreator[];
  actorId: string | null;
}

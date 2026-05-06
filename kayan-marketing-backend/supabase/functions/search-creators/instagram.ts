// Per-platform module for Instagram via apify/instagram-scraper.
//
// User-search mode: `search` is a single string + `searchType: "user"`. The
// actor returns matching account records — username, full name, follower
// count, profile picture.

import { MAX_PROFILES_PER_ACTOR } from "../_shared/influencer-actors.ts";
import type { CreatorSearchFilters, NormalizedCreator } from "./types.ts";

export function buildInput(filters: CreatorSearchFilters): Record<string, unknown> {
  const country = filters.countries[0] ?? "sa";
  const categories =
    filters.categories.length > 0 ? filters.categories.join(" ") : "creator";
  const search = `${categories} ${country}`;

  return {
    search,
    searchType: "user",
    searchLimit: MAX_PROFILES_PER_ACTOR,
    addParentData: false,
  };
}

interface IgRawUser {
  username?: unknown;
  fullName?: unknown;
  profilePicUrl?: unknown;
  profilePicUrlHD?: unknown;
  followersCount?: unknown;
  postsCount?: unknown;
  biography?: unknown;
  // Some actor outputs use these alternate names.
  ownerUsername?: unknown;
  full_name?: unknown;
  profile_pic_url?: unknown;
  follower_count?: unknown;
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function pickNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalize(
  rawItems: unknown[],
  searchId: string,
): NormalizedCreator[] {
  const out: NormalizedCreator[] = [];
  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;
    const r = item as IgRawUser & Record<string, unknown>;
    const handle = pickString(r.username) ?? pickString(r.ownerUsername);
    if (!handle) continue;
    const followers =
      pickNumber(r.followersCount) || pickNumber(r.follower_count);
    out.push({
      search_id: searchId,
      platform: "instagram",
      handle: handle.replace(/^@/, ""),
      display_name: pickString(r.fullName) ?? pickString(r.full_name),
      avatar_url:
        pickString(r.profilePicUrlHD) ??
        pickString(r.profilePicUrl) ??
        pickString(r.profile_pic_url),
      follower_count: followers,
      engagement_rate: null,
      language: null,
      country: null,
      city: null,
      audience_demographics: {},
      raw: r,
      is_estimated_demographics: true,
    });
  }
  return out;
}

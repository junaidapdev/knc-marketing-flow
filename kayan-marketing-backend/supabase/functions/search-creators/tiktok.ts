// Per-platform module for TikTok via clockworks/tiktok-scraper.
//
// We use search mode (`searchSection: "/user"`), one query per content
// category. proxyCountryCode shifts the actor's POV to the requested GCC
// country so the search results bias toward local creators.

import { MAX_PROFILES_PER_ACTOR } from "../_shared/influencer-actors.ts";
import type { CreatorSearchFilters, NormalizedCreator } from "./types.ts";

export function buildInput(filters: CreatorSearchFilters): Record<string, unknown> {
  const country = filters.countries[0] ?? "sa";
  const baseQueries =
    filters.categories.length > 0 ? filters.categories : ["creator"];
  const queries = baseQueries.map((c) => `${c} ${country}`);

  return {
    searchQueries: queries,
    searchSection: "/user",
    maxProfilesPerQuery: Math.max(
      5,
      Math.floor(MAX_PROFILES_PER_ACTOR / queries.length),
    ),
    proxyCountryCode: country.toUpperCase(),
    shouldDownloadAvatars: false,
  };
}

// Defensive shape for clockworks user-search items. Field names vary per
// actor version; we accept the most common variants and pick the first
// one present.
interface TiktokRawUser {
  id?: unknown;
  secUid?: unknown;
  uniqueId?: unknown;
  name?: unknown;
  nickName?: unknown;
  signature?: unknown;
  avatar?: unknown;
  avatarMedium?: unknown;
  avatarLarger?: unknown;
  followerCount?: unknown;
  fans?: unknown;
  region?: unknown;
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
    const r = item as TiktokRawUser & Record<string, unknown>;
    const handle = pickString(r.uniqueId) ?? pickString(r.name);
    if (!handle) continue;
    const followers = pickNumber(r.followerCount) || pickNumber(r.fans);
    out.push({
      search_id: searchId,
      platform: "tiktok",
      handle: handle.replace(/^@/, ""),
      display_name: pickString(r.nickName) ?? pickString(r.name),
      avatar_url:
        pickString(r.avatar) ??
        pickString(r.avatarLarger) ??
        pickString(r.avatarMedium),
      follower_count: followers,
      engagement_rate: null,
      language: null,
      country: typeof r.region === "string" ? r.region.toLowerCase() : null,
      city: null,
      audience_demographics: {},
      raw: r,
      is_estimated_demographics: true,
    });
  }
  return out;
}

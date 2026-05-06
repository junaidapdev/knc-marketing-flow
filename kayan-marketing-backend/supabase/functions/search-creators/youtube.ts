// Per-platform module for YouTube via streamers/youtube-scraper.
//
// YouTube on Apify has no native "search channels" actor. This actor
// searches videos and returns channel metadata on each result. We dedupe
// by channelId (or channelName fallback) and keep the first sighting —
// since results are relevance-sorted, the most relevant video for each
// channel wins, which is a reasonable proxy for "best matching creator".

import { MAX_PROFILES_PER_ACTOR } from "../_shared/influencer-actors.ts";
import type { CreatorSearchFilters, NormalizedCreator } from "./types.ts";

export function buildInput(filters: CreatorSearchFilters): Record<string, unknown> {
  const country = filters.countries[0] ?? "sa";
  const baseQueries =
    filters.categories.length > 0 ? filters.categories : ["creator"];
  const queries = baseQueries.map((c) => `${c} ${country}`);

  return {
    searchQueries: queries,
    // Pull a few extra videos per query so dedup leaves us with enough
    // unique channels to fill the results grid.
    maxResults: Math.max(
      10,
      Math.floor((MAX_PROFILES_PER_ACTOR * 2) / queries.length),
    ),
    sortingOrder: "relevance",
  };
}

interface YtRawVideo {
  id?: unknown;
  url?: unknown;
  title?: unknown;
  channelName?: unknown;
  channelUrl?: unknown;
  channelId?: unknown;
  numberOfSubscribers?: unknown;
  thumbnailUrl?: unknown;
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
  const byChannel = new Map<string, NormalizedCreator>();
  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;
    const r = item as YtRawVideo & Record<string, unknown>;
    const channelKey =
      pickString(r.channelId) ?? pickString(r.channelName);
    if (!channelKey) continue;
    if (byChannel.has(channelKey)) continue;
    const channelName = pickString(r.channelName) ?? channelKey;
    byChannel.set(channelKey, {
      search_id: searchId,
      platform: "youtube",
      handle: channelName.replace(/^@/, ""),
      display_name: pickString(r.channelName),
      avatar_url: null,
      follower_count: pickNumber(r.numberOfSubscribers),
      engagement_rate: null,
      language: null,
      country: null,
      city: null,
      audience_demographics: {},
      raw: r,
      is_estimated_demographics: true,
    });
  }
  return Array.from(byChannel.values());
}

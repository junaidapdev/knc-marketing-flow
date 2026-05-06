// Pinned Apify actor IDs for the Influencer Search feature. Kept out of the
// individual Edge Functions so swapping a scraper is a one-line change.
//
// Choice rationale:
//
// TikTok — clockworks/tiktok-scraper. Flagship clockworks actor (4.75★ /
//   276 reviews, 171K users). Supports keyword search (searchQueries +
//   searchSection: "/user") and a proxyCountryCode that covers every GCC
//   country, the closest thing to a region filter Apify offers for TikTok
//   creator discovery. The performance-ingest Edge Function already uses
//   this actor for known-profile scraping, so we share the integration
//   pattern and the input shape rules.
//
// Instagram — apify/instagram-scraper. Official Apify actor (4.7★ / 398
//   reviews, 251K users, 99.9% success). Supports `search` +
//   `searchType: "user"` for keyword-based creator discovery, with
//   `searchLimit` capping the result set. Higher review count and success
//   rate than any third-party alternative.
//
// YouTube — streamers/youtube-scraper. Flagship YouTube actor (4.7★ / 154
//   reviews, 75K users). YouTube on Apify has no native "search channels"
//   actor — this video-search actor returns channel metadata on every
//   video result (channelName, channelUrl, channelId, numberOfSubscribers).
//   The normalizer dedupes by channelId so each creator appears once.
//
// Limitations to revisit if they bite:
// - TikTok: no native follower min/max input — applied client-side after
//   the actor returns. Same will be done for Instagram if needed.
// - YouTube: video-search → channel dedup means an active channel surfaces
//   even when only one of its recent videos matches the keyword. That's
//   probably the desired behavior; flag if it isn't.

// Actor IDs in Apify URLs are written with tildes (clockworks~tiktok-
// scraper) but human-readable form uses slashes. We store the human form
// here and let the apify wrapper translate.
export const INFLUENCER_ACTORS = {
  tiktok: "clockworks/tiktok-scraper",
  instagram: "apify/instagram-scraper",
  youtube: "streamers/youtube-scraper",
} as const;

// Sensible cap per actor call so we never accidentally request thousands of
// profiles from a single search. The Edge Function caps the merged result
// set at 100 — this is the per-actor budget that feeds into that.
export const MAX_PROFILES_PER_ACTOR = 40;

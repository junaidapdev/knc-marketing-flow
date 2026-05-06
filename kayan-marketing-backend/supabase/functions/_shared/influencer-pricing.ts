// Single source of truth for Apify and Claude per-unit pricing used by the
// Influencer Search feature. Update these numbers when the pricing pages
// change — the Edge Functions never inline these values.
//
// Apify prices below are per-result on the FREE tier (the highest rate per
// the published Store pages). Real bills will be lower on paid tiers; we
// intentionally over-estimate so the cost-preview modal isn't a surprise
// to the upside. Source: each actor's Apify Store page.
//
// Claude Haiku 4.5 prices are per-million-tokens. Update when Anthropic
// publishes new model pricing.

export const APIFY_PER_RESULT_USD = {
  tiktok: 0.0037, // clockworks/tiktok-scraper, FREE tier per-result event
  instagram: 0.0027, // apify/instagram-scraper, FREE tier per-result
  youtube: 0.004, // streamers/youtube-scraper, FREE tier per-video
} as const;

// Some actors charge a small flat fee on actor start. Set to 0 where the
// store page doesn't list one, otherwise the published flat-fee event.
export const APIFY_ACTOR_START_USD = {
  tiktok: 0.001,
  instagram: 0,
  youtube: 0,
} as const;

// Claude Haiku 4.5 pricing — USD per million tokens. Used to convert the
// `usage.input_tokens` / `usage.output_tokens` returned by /v1/messages
// into a USD cost figure for the audit row + cost-preview modal.
export const CLAUDE_HAIKU_PRICING = {
  inputPerMillionUsd: 1.0,
  outputPerMillionUsd: 5.0,
} as const;

// Convenience: round a USD figure to 2 decimal places, returning a number.
// Cost rows are stored at 4dp in the DB (numeric(10,4)), but the API
// surface and the UI round to cents.
export function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

// Convenience: round to 4dp for storage. Matches numeric(10,4) precision
// so the DB never silently truncates.
export function roundUsd4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

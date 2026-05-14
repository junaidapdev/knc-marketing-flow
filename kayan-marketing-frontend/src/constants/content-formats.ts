// Content formats — after migration 0050, calendar_entries.type was split
// into `format` (what kind of content) + per-platform `entry_publications`
// (where it's posted). One shoot can land on 1-3 platforms but is one row.

export const CONTENT_FORMATS = {
  VIDEO: "video",
  STORY: "story",
  SHOP_ACTIVITY: "shop_activity",
  INFLUENCER_COLLAB: "influencer_collab",
  OFFER: "offer",
  GENERAL: "general",
} as const;

export type ContentFormat = (typeof CONTENT_FORMATS)[keyof typeof CONTENT_FORMATS];

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  video: "Video",
  story: "Story",
  shop_activity: "Shop Activity",
  influencer_collab: "Influencer Collab",
  offer: "Offer",
  general: "General Task",
};

// Set of formats that carry per-platform publications (video, story). Other
// formats (shop_activity, influencer_collab, offer, general) have no platforms.
export const CONTENT_FORMATS_WITH_PLATFORMS: ReadonlySet<ContentFormat> = new Set([
  CONTENT_FORMATS.VIDEO,
  CONTENT_FORMATS.STORY,
]);

// Whether the format participates in the batch shoot rhythm (script → shoot →
// edit → schedule). Only video — stories are quick / ad-hoc, other formats
// have their own chains.
export const BATCHABLE_FORMATS: ReadonlySet<ContentFormat> = new Set([
  CONTENT_FORMATS.VIDEO,
]);

export function isContentFormat(format: ContentFormat): boolean {
  return CONTENT_FORMATS_WITH_PLATFORMS.has(format);
}

// Content formats — after migration 0050, calendar_entries.type was replaced
// by `format` (one of these values) plus a per-platform `entry_publications`
// table. See supabase/migrations/0050_content_format_and_publications.sql.

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

export const PLATFORMS = {
  TIKTOK: "tiktok",
  INSTAGRAM: "instagram",
  SNAPCHAT: "snapchat",
} as const;

export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];

export const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
};

export const ENTRY_TYPES = {
  TIKTOK_VIDEO: "tiktok_video",
  INSTAGRAM_REEL: "instagram_reel",
  INSTAGRAM_STORY: "instagram_story",
  SNAPCHAT_STORY: "snapchat_story",
  SHOP_ACTIVITY: "shop_activity",
  INFLUENCER_COLLAB: "influencer_collab",
  OFFER: "offer",
  GENERAL: "general",
} as const;

export type EntryType = (typeof ENTRY_TYPES)[keyof typeof ENTRY_TYPES];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  tiktok_video: "TikTok Video",
  instagram_reel: "Instagram Reel",
  instagram_story: "Instagram Story",
  snapchat_story: "Snapchat Story",
  shop_activity: "Shop Activity",
  influencer_collab: "Influencer Collab",
  offer: "Offer",
  general: "General Task",
};

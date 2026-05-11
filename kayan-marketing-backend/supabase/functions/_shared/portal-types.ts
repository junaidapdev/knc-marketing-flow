export type PortalPlatformKey = "tiktok" | "instagram" | "snapchat";

export interface PortalPlatformView {
  key: PortalPlatformKey;
  label: string;
  handle: string;
  url: string | null;
  followers: number | null;
}

export interface PortalInfluencerView {
  displayName: string;
  city: string | null;
  platforms: PortalPlatformView[];
  nicheTags: string[];
  languages: string[];
}

export interface PortalInfluencerRecord {
  id: string;
  display_name: string;
  city: string | null;
  tiktok_handle: string | null;
  tiktok_url: string | null;
  tiktok_followers: number | null;
  instagram_handle: string | null;
  instagram_url: string | null;
  instagram_followers: number | null;
  snapchat_handle: string | null;
  snapchat_url: string | null;
  snapchat_followers: number | null;
  niche_tags: string[];
  languages: string[];
}

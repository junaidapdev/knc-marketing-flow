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

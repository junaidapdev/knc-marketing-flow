export type PortalPlatformKey = "tiktok" | "instagram" | "snapchat";

export interface PortalPlatformView {
  key: PortalPlatformKey;
  label: string;
  handle: string;
  url: string | null;
  followers: number | null;
}

// Reliability shape on the portal. Discriminated by `available` so the
// UI can render either the three-metric card or the "complete N more
// collabs" placeholder.
export type PortalReliabilityView =
  | {
      available: true;
      postRate: number | null;
      tagRate: number | null;
      onTimeRate: number | null;
      totalCollabs: number;
    }
  | {
      available: false;
      reason: "complete_3_collabs";
      totalCollabs: number;
    };

export interface PortalInfluencerView {
  displayName: string;
  city: string | null;
  platforms: PortalPlatformView[];
  nicheTags: string[];
  languages: string[];
  reliability: PortalReliabilityView;
}

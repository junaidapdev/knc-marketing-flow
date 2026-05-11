export type PortalPlatformKey = "tiktok" | "instagram" | "snapchat";

export interface PortalPlatformView {
  key: PortalPlatformKey;
  label: string;
  handle: string;
  url: string | null;
  followers: number | null;
}

// Reliability for the public portal view. Gated by ≥3 eligible
// collabs — fewer than that and the score is too noisy to be fair to
// the creator. When gated, we send `available: false` plus a machine-
// readable reason and the current totalCollabs so the UI can render a
// friendly "you're N away" message.
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

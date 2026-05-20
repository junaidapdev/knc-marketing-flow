import type { Influencer } from "../types/influencer";

export const INFLUENCER_PLATFORMS = [
  "tiktok",
  "instagram",
  "snapchat",
] as const;
export type InfluencerPlatform = (typeof INFLUENCER_PLATFORMS)[number];

export const INFLUENCER_PLATFORM_LABELS: Record<InfluencerPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
};

// A creator "has" a platform if EITHER a handle was captured OR a
// follower count was reported. This is intentionally permissive so
// that rows from the 2026-05 bulk import (where a creator reported
// followers but their URL was a reel/invite/blank) still surface
// under the relevant platform filter.
export function hasPlatform(
  influencer: Influencer,
  platform: InfluencerPlatform,
): boolean {
  switch (platform) {
    case "tiktok":
      return (
        Boolean(influencer.tiktokHandle) || influencer.tiktokFollowers !== null
      );
    case "instagram":
      return (
        Boolean(influencer.instagramHandle) ||
        influencer.instagramFollowers !== null
      );
    case "snapchat":
      return (
        Boolean(influencer.snapchatHandle) ||
        influencer.snapchatFollowers !== null
      );
  }
}

export function getInfluencerPlatforms(
  influencer: Influencer,
): InfluencerPlatform[] {
  return INFLUENCER_PLATFORMS.filter((p) => hasPlatform(influencer, p));
}

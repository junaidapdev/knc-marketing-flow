import type { Influencer } from "../types/influencer";

// Tier classification by highest follower count across platforms.
// Thresholds match the convention used in the previous table view, so
// existing creators don't reshuffle when the card UI shipped.
export const INFLUENCER_TIERS = ["macro", "mid", "micro", "nano"] as const;
export type InfluencerTier = (typeof INFLUENCER_TIERS)[number];

export const INFLUENCER_TIER_LABELS: Record<InfluencerTier, string> = {
  macro: "Macro",
  mid: "Mid",
  micro: "Micro",
  nano: "Nano",
};

const TIER_THRESHOLDS: ReadonlyArray<{ tier: InfluencerTier; min: number }> = [
  { tier: "macro", min: 500_000 },
  { tier: "mid", min: 100_000 },
  { tier: "micro", min: 10_000 },
  { tier: "nano", min: 1 },
];

// Highest follower count across TikTok / Instagram / Snapchat. Nulls
// count as 0 so a creator with only one platform is judged on that one.
export function highestFollowerCount(influencer: Influencer): number {
  return Math.max(
    influencer.tiktokFollowers ?? 0,
    influencer.instagramFollowers ?? 0,
    influencer.snapchatFollowers ?? 0,
  );
}

export function classifyTier(followerCount: number): InfluencerTier | null {
  const found = TIER_THRESHOLDS.find((t) => followerCount >= t.min);
  return found?.tier ?? null;
}

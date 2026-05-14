import type { ContentFormat } from "./content-formats";
import type { SocialPlatform } from "./social-platform";

// Maps content formats to the design's pastel chip palette. Each tuple gives
// the background, text color, and a faint border so chips read against either
// the cream canvas or a white card.
//
// Note: this is the FORMAT color (what kind of content), not platform color.
// For per-platform badges on calendar chips, use PLATFORM_CHIP_COLORS below.
export const FORMAT_COLORS: Record<ContentFormat, { bg: string; text: string; border: string }> = {
  video: { bg: "bg-obsidian", text: "text-white", border: "border-obsidian" },
  story: { bg: "bg-peach", text: "text-[#7A3520]", border: "border-peach-deep/40" },
  shop_activity: { bg: "bg-sage", text: "text-[#2C5530]", border: "border-sage-deep/40" },
  influencer_collab: { bg: "bg-lavender", text: "text-[#4A3A6A]", border: "border-lavender-deep/40" },
  offer: { bg: "bg-rose", text: "text-[#6E2A35]", border: "border-rose-deep/40" },
  general: { bg: "bg-sky", text: "text-[#2C4A66]", border: "border-sky-deep/40" },
};

// Per-platform mini-chip colors (used on calendar entry cards to show "this
// goes to TikTok + IG + Snap" at a glance).
export const PLATFORM_CHIP_COLORS: Record<SocialPlatform, { bg: string; text: string }> = {
  tiktok: { bg: "bg-obsidian", text: "text-white" },
  instagram: { bg: "bg-peach", text: "text-[#7A3520]" },
  snapchat: { bg: "bg-yellow", text: "text-obsidian" },
};

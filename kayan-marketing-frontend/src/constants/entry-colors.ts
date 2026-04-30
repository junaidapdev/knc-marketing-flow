import type { EntryType } from "./entry-types";

// Maps entry types to the design's pastel chip palette. Each tuple gives the
// background, text color, and a faint border so chips read against either the
// cream canvas or a white card.
export const ENTRY_TYPE_COLORS: Record<EntryType, { bg: string; text: string; border: string }> = {
  tiktok_video: { bg: "bg-obsidian", text: "text-white", border: "border-obsidian" },
  instagram_reel: { bg: "bg-peach", text: "text-[#7A3520]", border: "border-peach-deep/40" },
  instagram_story: { bg: "bg-peach", text: "text-[#7A3520]", border: "border-peach-deep/40" },
  snapchat_story: { bg: "bg-yellow", text: "text-obsidian", border: "border-yellow" },
  shop_activity: { bg: "bg-sage", text: "text-[#2C5530]", border: "border-sage-deep/40" },
  influencer_collab: { bg: "bg-lavender", text: "text-[#4A3A6A]", border: "border-lavender-deep/40" },
  offer: { bg: "bg-rose", text: "text-[#6E2A35]", border: "border-rose-deep/40" },
  general: { bg: "bg-sky", text: "text-[#2C4A66]", border: "border-sky-deep/40" },
};

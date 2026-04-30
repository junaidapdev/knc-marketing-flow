export const SOCIAL_PLATFORMS = {
  TIKTOK: "tiktok",
  INSTAGRAM: "instagram",
  SNAPCHAT: "snapchat",
} as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[keyof typeof SOCIAL_PLATFORMS];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
};

export const SOCIAL_PLATFORM_COLORS: Record<SocialPlatform, string> = {
  tiktok: "#ec4899",
  instagram: "#a855f7",
  snapchat: "#facc15",
};

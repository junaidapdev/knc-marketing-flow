export const CAMPAIGN_TYPES = {
  OFFER: "offer",
  EVENT: "event",
  REWARD: "reward",
  SEASONAL: "seasonal",
  AWARENESS: "awareness",
  OTHER: "other",
} as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[keyof typeof CAMPAIGN_TYPES];

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  offer: "Offer",
  event: "Event",
  reward: "Reward",
  seasonal: "Seasonal",
  awareness: "Awareness",
  other: "Other",
};

export const CAMPAIGN_STATUSES = {
  PLANNED: "planned",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[keyof typeof CAMPAIGN_STATUSES];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const AD_PLATFORMS = {
  TIKTOK: "tiktok",
  SNAPCHAT: "snapchat",
  INSTAGRAM: "instagram",
} as const;

export type AdPlatform = (typeof AD_PLATFORMS)[keyof typeof AD_PLATFORMS];

export const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  tiktok: "TikTok",
  snapchat: "Snapchat",
  instagram: "Instagram",
};

export const AD_OBJECTIVES = {
  AWARENESS: "awareness",
  CONVERSION: "conversion",
  TRAFFIC: "traffic",
} as const;

export type AdObjective = (typeof AD_OBJECTIVES)[keyof typeof AD_OBJECTIVES];

export const AD_OBJECTIVE_LABELS: Record<AdObjective, string> = {
  awareness: "Awareness",
  conversion: "Conversion",
  traffic: "Traffic",
};

export const ROLLOUT_STATUSES = ["planned", "active", "done", "skipped"] as const;
export type RolloutStatus = (typeof ROLLOUT_STATUSES)[number];

export const INFLUENCER_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  BLACKLISTED: "blacklisted",
} as const;

export type InfluencerStatus =
  (typeof INFLUENCER_STATUS)[keyof typeof INFLUENCER_STATUS];

export const INFLUENCER_STATUS_LABELS: Record<InfluencerStatus, string> = {
  active: "Active",
  paused: "Paused",
  blacklisted: "Blacklisted",
};

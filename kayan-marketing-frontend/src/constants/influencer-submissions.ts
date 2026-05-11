export const INFLUENCER_SUBMISSION_STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  DISPUTED: "disputed",
} as const;

export type InfluencerSubmissionStatus =
  (typeof INFLUENCER_SUBMISSION_STATUS)[keyof typeof INFLUENCER_SUBMISSION_STATUS];

export const INFLUENCER_SUBMISSION_STATUS_LABELS: Record<
  InfluencerSubmissionStatus,
  string
> = {
  pending: "Pending",
  verified: "Verified",
  disputed: "Disputed",
};

export const INFLUENCER_PLATFORM = {
  TIKTOK: "tiktok",
  INSTAGRAM: "instagram",
  SNAPCHAT: "snapchat",
} as const;

export type InfluencerPlatform =
  (typeof INFLUENCER_PLATFORM)[keyof typeof INFLUENCER_PLATFORM];

export const INFLUENCER_PLATFORM_LABELS: Record<InfluencerPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
};

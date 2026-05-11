import type {
  InfluencerPlatform,
  InfluencerSubmissionStatus,
} from "../constants/influencer-submissions";

export interface InfluencerSubmission {
  id: string;
  influencerId: string;
  entryId: string;
  submittedAt: string;
  tiktokPostUrl: string | null;
  instagramPostUrl: string | null;
  snapchatPostUrl: string | null;
  taggedKayan: boolean | null;
  usedPromoCode: boolean | null;
  notes: string | null;
  verificationStatus: InfluencerSubmissionStatus;
  verifiedAt: string | null;
  verifiedBy: string | null;
  disputeReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerPerformanceLog {
  id: string;
  submissionId: string;
  influencerId: string;
  platform: InfluencerPlatform;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reach: number | null;
  loggedAt: string;
  notes: string | null;
}

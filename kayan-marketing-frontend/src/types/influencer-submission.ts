import type {
  InfluencerPlatform,
  InfluencerSubmissionStatus,
} from "../constants/influencer-submissions";
import type { EntryStatus } from "./calendar-entry";

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

export interface InfluencerSubmissionListItem extends InfluencerSubmission {
  influencer: {
    id: string;
    displayName: string;
  } | null;
  entry: {
    id: string;
    title: string;
    targetDate: string;
    status: EntryStatus;
  } | null;
  // Joined from `influencer_performance_logs` so the Influencer Detail
  // page can aggregate totals without fetching detail per submission.
  // Same shape as InfluencerSubmissionDetail.performanceLogs.
  performanceLogs: InfluencerPerformanceLog[];
}

export interface InfluencerSubmissionDetail extends InfluencerSubmission {
  influencer: {
    id: string;
    displayName: string;
    whatsapp: string;
  } | null;
  entry: {
    id: string;
    title: string;
    targetDate: string;
    status: EntryStatus;
  } | null;
  performanceLogs: InfluencerPerformanceLog[];
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

export interface PortalSubmissionView {
  entryId: string;
  submittedAt: string;
  tiktokPostUrl: string | null;
  instagramPostUrl: string | null;
  snapchatPostUrl: string | null;
  taggedKayan: boolean | null;
  usedPromoCode: boolean | null;
  notes: string | null;
  verificationStatus: InfluencerSubmissionStatus;
}

export interface PortalCollaboration {
  entryId: string;
  title: string;
  targetDate: string;
  status: EntryStatus;
  description: string | null;
  existingSubmission: PortalSubmissionView | null;
}

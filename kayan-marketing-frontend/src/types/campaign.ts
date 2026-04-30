import type {
  CampaignType,
  CampaignStatus,
  AdPlatform,
  AdObjective,
  RolloutStatus,
} from "../constants/campaign";
import type { Assignee } from "../constants/task-chains";

export interface Campaign {
  id: string;
  brandId: string;
  name: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  totalBudget: number;
  totalSpent: number;
  offerTrigger: string | null;
  offerReward: string | null;
  promoCode: string | null;
  customFields: Record<string, unknown>;
  results: Record<string, unknown>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignBranchRollout {
  id: string;
  campaignId: string;
  branchId: string;
  rolloutDate: string;
  leadAssignee: Assignee;
  status: RolloutStatus;
  calendarEntryId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignAdSpend {
  id: string;
  campaignId: string;
  platform: AdPlatform;
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  objective: AdObjective | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CampaignDetail = Campaign & {
  campaignBranchRollouts: CampaignBranchRollout[];
  campaignAdSpend: CampaignAdSpend[];
};

export interface CampaignCreateResult {
  campaign: Campaign;
  rollouts: CampaignBranchRollout[];
  adSpend: CampaignAdSpend[];
}

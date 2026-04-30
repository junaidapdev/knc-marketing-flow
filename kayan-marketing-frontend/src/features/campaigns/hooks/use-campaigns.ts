import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type {
  Campaign,
  CampaignDetail,
  CampaignCreateResult,
} from "../../../types/campaign";
import type {
  CampaignType,
  CampaignStatus,
  AdPlatform,
  AdObjective,
} from "../../../constants/campaign";
import type { Assignee } from "../../../constants/task-chains";
import { logger } from "../../../utils/logger";

const CAMPAIGNS_KEY = ["campaigns"] as const;
const ENTRIES_KEY = ["calendar-entries"] as const;
const TASKS_KEY = ["tasks"] as const;

interface ListParams {
  status?: CampaignStatus;
}

export function useCampaigns(params: ListParams = {}) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, params],
    queryFn: async (): Promise<Campaign[]> => {
      const result = await apiRequest<Campaign[]>("/campaigns", {
        searchParams: { status: params.status },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, "detail", id],
    enabled: id !== null,
    queryFn: async (): Promise<CampaignDetail> => {
      const result = await apiRequest<CampaignDetail>(`/campaigns/${id}`);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export interface RolloutInput {
  branchId: string;
  branchName: string;
  rolloutDate: string;
  leadAssignee: Assignee;
  notes?: string | null;
}

export interface AdSpendInput {
  platform: AdPlatform;
  startDate: string;
  endDate: string;
  budget: number;
  objective?: AdObjective | null;
}

export interface CreateCampaignInput {
  brandId: string;
  name: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  totalBudget: number;
  offerTrigger?: string | null;
  offerReward?: string | null;
  promoCode?: string | null;
  customFields?: Record<string, unknown>;
  notes?: string | null;
  branchRollouts: RolloutInput[];
  adSpendLines: AdSpendInput[];
  autoCreateEntries: boolean;
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCampaignInput): Promise<CampaignCreateResult> => {
      const result = await apiRequest<CampaignCreateResult>("/campaigns", {
        method: "POST",
        body: input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      logger.info("campaign created", {
        campaignId: data.campaign.id,
        rollouts: data.rollouts.length,
        adLines: data.adSpend.length,
      });
    },
  });
}

export interface UpdateCampaignInput {
  name?: string;
  campaignType?: CampaignType;
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
  totalBudget?: number;
  totalSpent?: number;
  offerTrigger?: string | null;
  offerReward?: string | null;
  promoCode?: string | null;
  customFields?: Record<string, unknown>;
  results?: Record<string, unknown>;
  notes?: string | null;
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; input: UpdateCampaignInput }): Promise<Campaign> => {
      const result = await apiRequest<Campaign>(`/campaigns/${args.id}`, {
        method: "PATCH",
        body: args.input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      queryClient.invalidateQueries({ queryKey: [...CAMPAIGNS_KEY, "detail", campaign.id] });
      logger.info("campaign updated", { campaignId: campaign.id });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const result = await apiRequest<null>(`/campaigns/${id}`, { method: "DELETE" });
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

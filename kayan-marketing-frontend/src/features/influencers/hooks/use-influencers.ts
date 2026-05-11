import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type {
  Influencer,
  InfluencerFilters,
  CreateInfluencerInput,
  UpdateInfluencerInput,
} from "../../../types/influencer";
import { logger } from "../../../utils/logger";

const INFLUENCERS_KEY = ["influencers"] as const;

function filtersToParams(
  filters: InfluencerFilters | undefined,
): Record<string, string | undefined> {
  if (!filters) return {};
  return {
    status: filters.status,
    q: filters.q?.trim() || undefined,
    niche: filters.niche,
  };
}

export function useInfluencers(filters?: InfluencerFilters) {
  return useQuery({
    queryKey: [...INFLUENCERS_KEY, filters],
    queryFn: async (): Promise<Influencer[]> => {
      const result = await apiRequest<Influencer[]>("/influencers", {
        searchParams: filtersToParams(filters),
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useInfluencer(id: string | null) {
  return useQuery({
    queryKey: [...INFLUENCERS_KEY, "detail", id],
    enabled: id !== null,
    queryFn: async (): Promise<Influencer> => {
      const result = await apiRequest<Influencer>(`/influencers/${id}`);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useCreateInfluencer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInfluencerInput): Promise<Influencer> => {
      const result = await apiRequest<Influencer>("/influencers", {
        method: "POST",
        body: input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (influencer) => {
      queryClient.invalidateQueries({ queryKey: INFLUENCERS_KEY });
      logger.info("influencer created", { id: influencer.id });
    },
  });
}

export function useUpdateInfluencer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      input: UpdateInfluencerInput;
    }): Promise<Influencer> => {
      const result = await apiRequest<Influencer>(`/influencers/${args.id}`, {
        method: "PATCH",
        body: args.input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (influencer) => {
      queryClient.invalidateQueries({ queryKey: INFLUENCERS_KEY });
      queryClient.invalidateQueries({
        queryKey: [...INFLUENCERS_KEY, "detail", influencer.id],
      });
      logger.info("influencer updated", { id: influencer.id });
    },
  });
}

export function useDeleteInfluencer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const result = await apiRequest<null>(`/influencers/${id}`, {
        method: "DELETE",
      });
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: INFLUENCERS_KEY });
      queryClient.removeQueries({
        queryKey: [...INFLUENCERS_KEY, "detail", id],
      });
      logger.info("influencer deleted", { id });
    },
  });
}

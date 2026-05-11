import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type {
  Influencer,
  InfluencerFilters,
  InfluencerWithReliability,
  CreateInfluencerInput,
  UpdateInfluencerInput,
} from "../../../types/influencer";
import type { InfluencerStatus } from "../../../constants/influencer-status";
import { logger } from "../../../utils/logger";

const INFLUENCERS_KEY = ["influencers"] as const;

function filtersToParams(
  filters: InfluencerFilters | undefined,
  includeReliability = false,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {
    status: filters?.status,
    q: filters?.q?.trim() || undefined,
    niche: filters?.niche,
  };
  if (includeReliability) out.includeReliability = "true";
  return out;
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

// Same list, but each row carries the influencer's reliability score.
// Slightly heavier on the backend (one RPC per row) — only call when
// the reliability column / filter is actually shown.
export function useInfluencersWithReliability(filters?: InfluencerFilters) {
  return useQuery({
    queryKey: [...INFLUENCERS_KEY, "with-reliability", filters],
    queryFn: async (): Promise<InfluencerWithReliability[]> => {
      const result = await apiRequest<InfluencerWithReliability[]>(
        "/influencers",
        { searchParams: filtersToParams(filters, true) },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useInfluencer(id: string | null) {
  return useQuery({
    queryKey: [...INFLUENCERS_KEY, "detail", id],
    enabled: id !== null,
    queryFn: async (): Promise<InfluencerWithReliability> => {
      const result = await apiRequest<InfluencerWithReliability>(
        `/influencers/${id}`,
      );
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

// POST /influencers/:id/rotate-token — invalidates the old portal link
// and returns the updated influencer with the fresh token. The portal
// will reject the old token from this moment on.
export function useRotateInfluencerToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<InfluencerWithReliability> => {
      const result = await apiRequest<InfluencerWithReliability>(
        `/influencers/${id}/rotate-token`,
        { method: "POST" },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (influencer) => {
      queryClient.invalidateQueries({ queryKey: INFLUENCERS_KEY });
      queryClient.invalidateQueries({
        queryKey: [...INFLUENCERS_KEY, "detail", influencer.id],
      });
      logger.info("influencer portal token rotated", { id: influencer.id });
    },
  });
}

// PATCH /influencers/:id/status — narrow flip for active / paused /
// blacklisted. Paused + blacklisted both block portal access on the
// backend (same opaque 401 as an invalid token).
export function useUpdateInfluencerStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      status: InfluencerStatus;
    }): Promise<InfluencerWithReliability> => {
      const result = await apiRequest<InfluencerWithReliability>(
        `/influencers/${args.id}/status`,
        { method: "PATCH", body: { status: args.status } },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (influencer) => {
      queryClient.invalidateQueries({ queryKey: INFLUENCERS_KEY });
      queryClient.invalidateQueries({
        queryKey: [...INFLUENCERS_KEY, "detail", influencer.id],
      });
      logger.info("influencer status updated", {
        id: influencer.id,
        status: influencer.status,
      });
    },
  });
}

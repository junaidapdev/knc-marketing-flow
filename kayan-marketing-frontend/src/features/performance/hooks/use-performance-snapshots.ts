import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { PerformanceSnapshot } from "../../../types/performance";
import type { SocialPlatform } from "../../../constants/social-platform";
import { logger } from "../../../utils/logger";

const SNAPSHOTS_KEY = ["performance-snapshots"] as const;

interface ListParams {
  brandId: string;
  from?: string;
  to?: string;
  platform?: SocialPlatform;
}

export function usePerformanceSnapshots(params: ListParams) {
  return useQuery({
    queryKey: [...SNAPSHOTS_KEY, params],
    queryFn: async (): Promise<PerformanceSnapshot[]> => {
      const result = await apiRequest<PerformanceSnapshot[]>("/performance-snapshots", {
        searchParams: {
          brandId: params.brandId,
          from: params.from,
          to: params.to,
          platform: params.platform,
        },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export interface UpsertSnapshotInput {
  brandId: string;
  snapshotDate: string;
  platform: SocialPlatform;
  followers?: number | null;
  totalViews?: number | null;
  totalLikes?: number | null;
  totalComments?: number | null;
  totalShares?: number | null;
  reach?: number | null;
  notes?: string | null;
}

export function useUpsertSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertSnapshotInput): Promise<PerformanceSnapshot> => {
      const result = await apiRequest<PerformanceSnapshot>("/performance-snapshots", {
        method: "POST",
        body: input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (snapshot) => {
      queryClient.invalidateQueries({ queryKey: SNAPSHOTS_KEY });
      logger.info("snapshot upserted", {
        platform: snapshot.platform,
        date: snapshot.snapshotDate,
      });
    },
  });
}

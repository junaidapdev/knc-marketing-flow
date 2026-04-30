import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import { logger } from "../../../utils/logger";

// Manual refresh hook — calls the performance-ingest Edge Function which in
// turn drives Apify scrapers for IG + TikTok. On success we invalidate every
// query that reads from the two tables we just wrote to (snapshots + posts)
// and the brand query (so the "Last synced" badge refreshes).

export interface IngestSummary {
  platform: "instagram" | "tiktok";
  handle: string;
  followers: number | null;
  postsIngested: number;
  error?: string;
}

export interface IngestResponse {
  syncedAt: string;
  summaries: IngestSummary[];
}

export function useIngestPerformance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<IngestResponse> => {
      const result = await apiRequest<IngestResponse>("/performance-ingest", {
        method: "POST",
        body: {},
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["performance-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["top-posts"] });
      queryClient.invalidateQueries({ queryKey: ["brand"] });
      logger.info("apify ingest done", { syncedAt: data.syncedAt });
    },
  });
}

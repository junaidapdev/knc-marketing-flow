import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type {
  CreatorSearchFilters,
  CreatorSearchResponse,
} from "../../../types/influencer";

// Real backend call (Chunk 3+4). The Edge Function fans out to TikTok,
// Instagram, and YouTube in parallel via Promise.allSettled — partial
// failures populate `failureReasons` instead of failing the whole search.
// Throws on full failure (all platforms errored or any infrastructure
// error) so the React Query error path renders the inline strip.
export function useCreatorSearch() {
  return useMutation({
    mutationFn: async (
      filters: CreatorSearchFilters,
    ): Promise<CreatorSearchResponse> => {
      const result = await apiRequest<CreatorSearchResponse>(
        "/search-creators",
        {
          method: "POST",
          body: filters,
        },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

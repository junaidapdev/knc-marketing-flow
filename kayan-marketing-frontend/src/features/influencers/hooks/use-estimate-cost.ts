import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type {
  CreatorSearchEstimate,
  CreatorSearchFilters,
} from "../../../types/influencer";

// Pre-search cost preview. Pure math on the backend — never hits Apify or
// Anthropic. Returns the estimate for the supplied filter set so the user
// can confirm before triggering a paid run.
export function useEstimateCost() {
  return useMutation({
    mutationFn: async (
      filters: CreatorSearchFilters,
    ): Promise<CreatorSearchEstimate> => {
      const result = await apiRequest<CreatorSearchEstimate>(
        "/estimate-creator-search",
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

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { TodaySummary } from "../../../types/today-summary";

export const TODAY_SUMMARY_KEY = ["today-summary"] as const;

export function todaySummaryQueryKey(brandId: string, today: string): readonly unknown[] {
  return [...TODAY_SUMMARY_KEY, brandId, today];
}

export function useTodaySummary(brandId: string, today: string) {
  return useQuery({
    queryKey: todaySummaryQueryKey(brandId, today),
    queryFn: async (): Promise<TodaySummary> => {
      const result = await apiRequest<TodaySummary>("/today-summary", {
        searchParams: { brandId, today },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 60_000,
  });
}

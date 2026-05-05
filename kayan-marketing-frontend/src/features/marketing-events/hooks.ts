import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../utils/api-client";
import type { MarketingEvent, MarketingEventFilters } from "../../types/marketing-event";

export const MARKETING_EVENTS_KEY = ["marketing-events"] as const;

export function marketingEventsQueryKey(filters: MarketingEventFilters): readonly unknown[] {
  return [...MARKETING_EVENTS_KEY, filters];
}

export function useMarketingEvents(filters: MarketingEventFilters) {
  return useQuery({
    queryKey: marketingEventsQueryKey(filters),
    queryFn: async (): Promise<MarketingEvent[]> => {
      const result = await apiRequest<MarketingEvent[]>("/marketing-events", {
        searchParams: {
          brandId: filters.brandId,
          from: filters.from,
          to: filters.to,
          importance: filters.importance,
          eventType: filters.eventType,
          includeArchived: filters.includeArchived ? "true" : undefined,
        },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 5 * 60_000,
  });
}

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { CalendarEntry } from "../../../types/calendar-entry";

export function useCampaignEntries(campaignId: string | null) {
  return useQuery({
    queryKey: ["calendar-entries", "by-campaign", campaignId],
    enabled: campaignId !== null,
    queryFn: async (): Promise<CalendarEntry[]> => {
      const result = await apiRequest<CalendarEntry[]>("/calendar-entries", {
        searchParams: { campaignId: campaignId ?? undefined },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

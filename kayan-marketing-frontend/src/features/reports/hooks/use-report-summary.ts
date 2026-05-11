import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { ReportSummary } from "../../../types/report-summary";

const REPORT_SUMMARY_KEY = ["reports", "summary"] as const;
const REPORT_STALE_TIME_MS = 60_000;

export interface ReportSummaryParams {
  from: string;
  to: string;
  compareToPrevious: boolean;
  campaignId?: string;
  branchId?: string;
}

export function useReportSummary(
  params: ReportSummaryParams | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...REPORT_SUMMARY_KEY, params],
    enabled: enabled && params !== null,
    staleTime: REPORT_STALE_TIME_MS,
    queryFn: async (): Promise<ReportSummary> => {
      if (!params) throw new Error("Report params missing.");
      const result = await apiRequest<ReportSummary>("/reports/summary", {
        searchParams: {
          from: params.from,
          to: params.to,
          compareToPrevious: params.compareToPrevious ? "true" : "false",
          campaignId: params.campaignId,
          branchId: params.branchId,
        },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

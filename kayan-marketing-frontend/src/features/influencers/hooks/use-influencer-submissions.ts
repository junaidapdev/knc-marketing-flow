import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  InfluencerPlatform,
  InfluencerSubmissionStatus,
} from "../../../constants/influencer-submissions";
import type {
  InfluencerPerformanceLog,
  InfluencerSubmissionDetail,
  InfluencerSubmissionListItem,
} from "../../../types/influencer-submission";
import { apiRequest } from "../../../utils/api-client";
import { logger } from "../../../utils/logger";

const SUBMISSIONS_KEY = ["influencer-submissions"] as const;
const PERFORMANCE_KEY = ["influencer-performance"] as const;
const TASKS_KEY = ["tasks"] as const;
const ENTRIES_KEY = ["calendar-entries"] as const;

interface SubmissionFilters {
  status?: InfluencerSubmissionStatus;
  influencerId?: string;
  from?: string;
  to?: string;
}

function submissionParams(filters: SubmissionFilters | undefined): Record<string, string | undefined> {
  return {
    status: filters?.status,
    influencerId: filters?.influencerId,
    from: filters?.from,
    to: filters?.to,
  };
}

export function useInfluencerSubmissions(filters?: SubmissionFilters) {
  return useQuery({
    queryKey: [...SUBMISSIONS_KEY, filters],
    queryFn: async (): Promise<InfluencerSubmissionListItem[]> => {
      const result = await apiRequest<InfluencerSubmissionListItem[]>(
        "/influencer-submissions",
        { searchParams: submissionParams(filters) },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useInfluencerSubmission(id: string | null) {
  return useQuery({
    queryKey: [...SUBMISSIONS_KEY, "detail", id],
    enabled: id !== null,
    queryFn: async (): Promise<InfluencerSubmissionDetail> => {
      const result = await apiRequest<InfluencerSubmissionDetail>(
        `/influencer-submissions/${id}`,
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useUpdateInfluencerSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      input: {
        verificationStatus: "verified" | "disputed";
        disputeReason?: string | null;
      };
    }): Promise<unknown> => {
      const result = await apiRequest<unknown>(`/influencer-submissions/${args.id}`, {
        method: "PATCH",
        body: args.input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (_data, args) => {
      queryClient.invalidateQueries({ queryKey: SUBMISSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: [...SUBMISSIONS_KEY, "detail", args.id] });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });
      logger.info("influencer submission updated", { id: args.id });
    },
  });
}

export function useInfluencerPerformanceLogs(submissionId: string | null) {
  return useQuery({
    queryKey: [...PERFORMANCE_KEY, submissionId],
    enabled: submissionId !== null,
    queryFn: async (): Promise<InfluencerPerformanceLog[]> => {
      const result = await apiRequest<InfluencerPerformanceLog[]>(
        "/influencer-performance",
        { searchParams: { submissionId: submissionId ?? undefined } },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export interface CreatePerformanceLogInput {
  submissionId: string;
  platform: InfluencerPlatform;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  reach?: number | null;
  notes?: string | null;
}

export function useCreateInfluencerPerformanceLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePerformanceLogInput): Promise<InfluencerPerformanceLog> => {
      const result = await apiRequest<InfluencerPerformanceLog>("/influencer-performance", {
        method: "POST",
        body: input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (log) => {
      queryClient.invalidateQueries({ queryKey: PERFORMANCE_KEY });
      queryClient.invalidateQueries({ queryKey: SUBMISSIONS_KEY });
      logger.info("influencer performance logged", {
        submissionId: log.submissionId,
        platform: log.platform,
      });
    },
  });
}

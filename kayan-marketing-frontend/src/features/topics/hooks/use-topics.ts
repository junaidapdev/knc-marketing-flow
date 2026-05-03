import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type {
  Topic,
  CreateTopicInput,
  UpdateTopicInput,
  UseTopicInput,
} from "../../../types/topic";
import type { TopicStatus } from "../../../constants/topics";
import type { CalendarEntry } from "../../../types/calendar-entry";
import type { Task } from "../../../types/task";
import { logger } from "../../../utils/logger";

const TOPICS_KEY = ["topics"] as const;

interface ListParams {
  status?: TopicStatus | "all";
  occasion?: string;
}

export function useTopics(params: ListParams = {}) {
  return useQuery({
    queryKey: [...TOPICS_KEY, params],
    queryFn: async (): Promise<Topic[]> => {
      const result = await apiRequest<Topic[]>("/topics", {
        searchParams: {
          // "all" means no filter — drop the param so the backend returns
          // every status. Anything else passes through verbatim.
          status: params.status && params.status !== "all" ? params.status : undefined,
          occasion: params.occasion || undefined,
        },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useTopic(topicId: string | null) {
  return useQuery({
    queryKey: [...TOPICS_KEY, "detail", topicId],
    enabled: topicId !== null,
    queryFn: async (): Promise<Topic> => {
      const result = await apiRequest<Topic>(`/topics/${topicId}`);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useCreateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTopicInput): Promise<Topic> => {
      const result = await apiRequest<Topic>("/topics", {
        method: "POST",
        body: input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (topic) => {
      queryClient.invalidateQueries({ queryKey: TOPICS_KEY });
      logger.info("topic created", { topicId: topic.id });
    },
  });
}

export function useUpdateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; input: UpdateTopicInput }): Promise<Topic> => {
      const result = await apiRequest<Topic>(`/topics/${args.id}`, {
        method: "PATCH",
        body: args.input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (topic) => {
      queryClient.invalidateQueries({ queryKey: TOPICS_KEY });
      queryClient.invalidateQueries({ queryKey: [...TOPICS_KEY, "detail", topic.id] });
    },
  });
}

// Soft delete — backend flips status to 'archived' so any calendar entry
// still pointing at this topic stays linked.
export function useArchiveTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Topic> => {
      const result = await apiRequest<Topic>(`/topics/${id}`, { method: "DELETE" });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TOPICS_KEY });
    },
  });
}

interface UseTopicResult {
  entry: CalendarEntry;
  tasks: Task[];
}

export function useUseTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; input: UseTopicInput }): Promise<UseTopicResult> => {
      const result = await apiRequest<UseTopicResult>(`/topics/${args.id}/use`, {
        method: "POST",
        body: args.input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: TOPICS_KEY });
      queryClient.invalidateQueries({ queryKey: ["calendar-entries"] });
      logger.info("topic used → entry created", {
        entryId: data.entry.id,
        taskCount: data.tasks.length,
      });
    },
  });
}

// AI suggester — bulk-generate topics. Returns the inserted topics + a
// `skipped` list when the LLM produced any malformed suggestions (rare).
interface SuggestResult {
  topics: Topic[];
  requested: number;
  generated: number;
  skipped: Array<{ index: number; reason: string }>;
  tokensUsed: number | null;
}

interface SuggestInput {
  count?: number;
  occasion?: string;
  excludeRecentDays?: number;
}

export function useSuggestTopics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SuggestInput): Promise<SuggestResult> => {
      const result = await apiRequest<SuggestResult>("/topic-suggester", {
        method: "POST",
        body: input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: TOPICS_KEY });
      logger.info("topics suggested", {
        generated: data.generated,
        requested: data.requested,
      });
    },
  });
}

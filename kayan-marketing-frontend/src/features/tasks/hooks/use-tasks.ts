import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { Task, TaskStatus } from "../../../types/task";
import type { Assignee, TaskPhase } from "../../../constants/task-chains";
import { logger } from "../../../utils/logger";

const TASKS_KEY = ["tasks"] as const;
const ENTRIES_KEY = ["calendar-entries"] as const;

interface ListParams {
  from?: string;
  to?: string;
  assignee?: Assignee;
  status?: TaskStatus;
  entryId?: string;
}

export function useTasks(params: ListParams) {
  return useQuery({
    queryKey: [...TASKS_KEY, params],
    queryFn: async (): Promise<Task[]> => {
      const result = await apiRequest<Task[]>("/tasks", {
        searchParams: {
          from: params.from,
          to: params.to,
          assignee: params.assignee,
          status: params.status,
          entryId: params.entryId,
        },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export interface CreateTaskInput {
  entryId?: string | null;
  campaignId?: string | null;
  title: string;
  phase?: TaskPhase | null;
  assignee: Assignee;
  dueDate: string;
  isStandalone: boolean;
  notes?: string | null;
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput): Promise<Task> => {
      const result = await apiRequest<Task>("/tasks", { method: "POST", body: input });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });
      logger.info("task created");
    },
  });
}

export interface UpdateTaskInput {
  title?: string;
  phase?: TaskPhase | null;
  assignee?: Assignee;
  dueDate?: string;
  status?: TaskStatus;
  notes?: string | null;
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; input: UpdateTaskInput }): Promise<Task> => {
      const result = await apiRequest<Task>(`/tasks/${args.id}`, {
        method: "PATCH",
        body: args.input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });
      logger.info("task updated", { taskId: task.id, status: task.status });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const result = await apiRequest<null>(`/tasks/${id}`, { method: "DELETE" });
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });
    },
  });
}

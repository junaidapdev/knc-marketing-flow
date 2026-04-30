import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { Task, TaskStatus } from "../../../types/task";
import type { TodaySummary } from "../../../types/today-summary";
import { todaySummaryQueryKey } from "./use-today-summary";
import { logger } from "../../../utils/logger";

interface ToggleArgs {
  taskId: string;
  nextStatus: TaskStatus;
}

interface Context {
  previous: TodaySummary | undefined;
  queryKey: readonly unknown[];
}

function applyTaskUpdate(summary: TodaySummary, taskId: string, nextStatus: TaskStatus): TodaySummary {
  const stamp = (t: Task): Task =>
    t.id === taskId
      ? {
          ...t,
          status: nextStatus,
          completedAt: nextStatus === "completed" ? new Date().toISOString() : null,
        }
      : t;

  return {
    ...summary,
    today: { ...summary.today, tasks: summary.today.tasks.map(stamp) },
    overdue: { ...summary.overdue, tasks: summary.overdue.tasks.map(stamp) },
    radar: {
      tomorrow: summary.radar.tomorrow.map(stamp),
      dayAfter: summary.radar.dayAfter.map(stamp),
      dayThree: summary.radar.dayThree.map(stamp),
    },
  };
}

// Optimistic toggle: writes the new status into the today-summary cache immediately,
// then PATCHes /tasks/:id. On failure, rolls the cache back to the snapshot.
export function useToggleTaskStatus(brandId: string, today: string) {
  const queryClient = useQueryClient();
  const queryKey = todaySummaryQueryKey(brandId, today);

  return useMutation<Task, Error, ToggleArgs, Context>({
    mutationFn: async ({ taskId, nextStatus }) => {
      const result = await apiRequest<Task>(`/tasks/${taskId}`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onMutate: async ({ taskId, nextStatus }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TodaySummary>(queryKey);
      if (previous) {
        queryClient.setQueryData<TodaySummary>(queryKey, applyTaskUpdate(previous, taskId, nextStatus));
      }
      return { previous, queryKey };
    },
    onError: (err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      logger.error("toggle task status failed; rolled back", { err: String(err) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { CalendarEntry } from "../../../types/calendar-entry";
import type { Task } from "../../../types/task";
import type { EntryStatus } from "../../../types/calendar-entry";
import type { Assignee, PreviewTask } from "../../../constants/task-chains";
import type { EntryType } from "../../../constants/entry-types";
import type { BudgetCategory } from "../../../constants/budget-categories";
import type { PatternId } from "../../../constants/patterns";
import { logger } from "../../../utils/logger";

const ENTRIES_KEY = ["calendar-entries"] as const;
const TASKS_KEY = ["tasks"] as const;

interface ListParams {
  from?: string;
  to?: string;
  branchId?: string;
  influencerId?: string;
  type?: EntryType;
}

export function useCalendarEntries(params: ListParams) {
  return useQuery({
    queryKey: [...ENTRIES_KEY, params],
    queryFn: async (): Promise<CalendarEntry[]> => {
      const result = await apiRequest<CalendarEntry[]>("/calendar-entries", {
        searchParams: {
          from: params.from,
          to: params.to,
          branchId: params.branchId,
          influencerId: params.influencerId,
          type: params.type,
        },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

// Detail responses replace the slim task summary on CalendarEntry with a
// full Task[]. We Omit the optional summary field first so the override is
// type-safe.
export type EntryWithTasks = Omit<CalendarEntry, "tasks"> & { tasks: Task[] };

export function useEntryDetail(entryId: string | null) {
  return useQuery({
    queryKey: [...ENTRIES_KEY, "detail", entryId],
    enabled: entryId !== null,
    queryFn: async (): Promise<EntryWithTasks> => {
      const result = await apiRequest<EntryWithTasks>(`/calendar-entries/${entryId}`);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export interface CreateEntryInput {
  brandId: string;
  type: EntryType;
  title: string;
  description?: string | null;
  targetDate: string;
  assignee: Assignee;
  campaignId?: string | null;
  branchId?: string | null;
  influencerId?: string | null;
  budgetAllocated?: number;
  budgetCategory?: BudgetCategory | null;
  notes?: string | null;
  autoCreateTasks: boolean;
  taskChainOverride?: PreviewTask[];
  // Production rhythm — batch is the default for video entries.
  productionMode?: "batch" | "adhoc";
  shootDate?: string | null;
  editorDaysOffset?: number;
  // Recipe Book V2 tagging (chunk 4). Both optional. The AI Generate flow
  // reads these on the saved entry and feeds them into the prompt brief.
  patternId?: PatternId | null;
  theme?: string | null;
}

export interface CreateEntryResult {
  entry: CalendarEntry;
  tasks: Task[];
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEntryInput): Promise<CreateEntryResult> => {
      const result = await apiRequest<CreateEntryResult>("/calendar-entries", {
        method: "POST",
        body: input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      logger.info("entry created", { entryId: data.entry.id, taskCount: data.tasks.length });
    },
  });
}

export interface UpdateEntryInput {
  title?: string;
  description?: string | null;
  targetDate?: string;
  assignee?: Assignee;
  status?: EntryStatus;
  budgetAllocated?: number;
  budgetSpent?: number;
  videoUrl?: string | null;
  postUrl?: string | null;
  notes?: string | null;
  branchId?: string | null;
  influencerId?: string | null;
  script?: string | null;
  shotDirections?: string | null;
  caption?: string | null;
  hashtags?: string | null;
  productionMode?: "batch" | "adhoc";
  shootDate?: string | null;
  editorDaysOffset?: number;
  // Recipe Book V2 tagging (chunk 4). null clears the field; undefined
  // leaves the existing DB value alone.
  patternId?: PatternId | null;
  theme?: string | null;
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; input: UpdateEntryInput }): Promise<CalendarEntry> => {
      const result = await apiRequest<CalendarEntry>(`/calendar-entries/${args.id}`, {
        method: "PATCH",
        body: args.input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });
      queryClient.invalidateQueries({ queryKey: [...ENTRIES_KEY, "detail", entry.id] });
      logger.info("entry updated", { entryId: entry.id });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const result = await apiRequest<null>(`/calendar-entries/${id}`, { method: "DELETE" });
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      logger.info("entry deleted", { entryId: id });
    },
  });
}

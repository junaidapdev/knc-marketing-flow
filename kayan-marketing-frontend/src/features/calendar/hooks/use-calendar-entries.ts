import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { CalendarEntry } from "../../../types/calendar-entry";
import type { Task } from "../../../types/task";
import type { EntryStatus } from "../../../types/calendar-entry";
import type { Assignee, PreviewTask } from "../../../constants/task-chains";
import type { ContentFormat } from "../../../constants/content-formats";
import type { SocialPlatform } from "../../../constants/social-platform";
import type { BudgetCategory } from "../../../constants/budget-categories";
import type { PatternId } from "../../../constants/patterns";
import type { EntryPublicationFull } from "../../../types/entry-publication";
import { logger } from "../../../utils/logger";

const ENTRIES_KEY = ["calendar-entries"] as const;
const TASKS_KEY = ["tasks"] as const;

interface ListParams {
  from?: string;
  to?: string;
  branchId?: string;
  influencerId?: string;
  format?: ContentFormat;
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
          format: params.format,
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
  format: ContentFormat;
  // Required for video/story formats; empty array (or omitted) for others.
  platforms?: SocialPlatform[];
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
  // Recipe Book V2 tagging.
  patternId?: PatternId | null;
  theme?: string | null;
}

export interface CreateEntryResult {
  entry: CalendarEntry;
  tasks: Task[];
  publications: EntryPublicationFull[];
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
  // post_url is no longer on the entry — it lives on each publication. Use
  // useUpdatePublication() to set per-platform URLs.
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

export interface UpdatePublicationInput {
  postUrl?: string | null;
  postedAt?: string | null;
}

// Patch a single publication (one platform's post_url / posted_at) without
// disturbing the parent entry's status. Used by the entry detail panel
// when the user pastes the live URL after publishing on a specific platform.
export function useUpdatePublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      entryId: string;
      platform: SocialPlatform;
      input: UpdatePublicationInput;
    }): Promise<EntryPublicationFull> => {
      const result = await apiRequest<EntryPublicationFull>(
        `/calendar-entries/${args.entryId}/publications/${args.platform}`,
        {
          method: "PATCH",
          body: args.input,
        },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (_data, args) => {
      queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });
      queryClient.invalidateQueries({
        queryKey: [...ENTRIES_KEY, "detail", args.entryId],
      });
    },
  });
}

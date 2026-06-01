import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import { logger } from "../../../utils/logger";
import type { MonthlyVideoPlanItem } from "../../../types/monthly-video-plan";

const PLAN_KEY = ["monthly-video-plan"] as const;

export function useMonthlyVideoPlan(brandId: string, month: string) {
  return useQuery({
    queryKey: [...PLAN_KEY, brandId, month],
    queryFn: async (): Promise<MonthlyVideoPlanItem[]> => {
      const result = await apiRequest<MonthlyVideoPlanItem[]>(
        "/monthly-video-plan",
        { searchParams: { brandId, month } },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export interface CreatePlanItemInput {
  brandId: string;
  month: string;
  label: string;
  count: number;
  countMax?: number | null;
}

export function useCreatePlanItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePlanItemInput): Promise<MonthlyVideoPlanItem> => {
      const result = await apiRequest<MonthlyVideoPlanItem>(
        "/monthly-video-plan",
        { method: "POST", body: input },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({
        queryKey: [...PLAN_KEY, item.brandId, item.month],
      });
      logger.info("plan item created", { id: item.id, month: item.month });
    },
  });
}

export interface UpdatePlanItemInput {
  id: string;
  brandId: string;
  month: string;
  label?: string;
  count?: number;
  countMax?: number | null;
  sortOrder?: number;
}

export function useUpdatePlanItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePlanItemInput): Promise<MonthlyVideoPlanItem> => {
      // brandId + month are only used for cache invalidation; the backend
      // identifies the row by :id so we strip them from the PATCH body.
      const patch: Record<string, unknown> = {};
      if (input.label !== undefined) patch.label = input.label;
      if (input.count !== undefined) patch.count = input.count;
      if (input.countMax !== undefined) patch.countMax = input.countMax;
      if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

      const result = await apiRequest<MonthlyVideoPlanItem>(
        `/monthly-video-plan/${input.id}`,
        { method: "PATCH", body: patch },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (item, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...PLAN_KEY, variables.brandId, variables.month],
      });
      logger.info("plan item updated", { id: item.id });
    },
  });
}

export interface DeletePlanItemInput {
  id: string;
  brandId: string;
  month: string;
}

export function useDeletePlanItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeletePlanItemInput): Promise<void> => {
      const result = await apiRequest<null>(
        `/monthly-video-plan/${input.id}`,
        { method: "DELETE" },
      );
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...PLAN_KEY, variables.brandId, variables.month],
      });
      logger.info("plan item deleted", { id: variables.id });
    },
  });
}

export interface CopyFromPreviousInput {
  brandId: string;
  targetMonth: string;
  sourceMonth: string;
}

export function useCopyFromPreviousMonth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: CopyFromPreviousInput,
    ): Promise<MonthlyVideoPlanItem[]> => {
      const result = await apiRequest<MonthlyVideoPlanItem[]>(
        "/monthly-video-plan/copy-from-previous",
        { method: "POST", body: input },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (items, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...PLAN_KEY, variables.brandId, variables.targetMonth],
      });
      logger.info("plan items copied", {
        count: items.length,
        targetMonth: variables.targetMonth,
      });
    },
  });
}

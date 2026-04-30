import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { BudgetSummary, BudgetCap } from "../../../types/budget";
import type { BudgetCategory } from "../../../constants/budget-categories";
import { logger } from "../../../utils/logger";

const SUMMARY_KEY = ["budget-summary"] as const;
const CAPS_KEY = ["budget-caps"] as const;

export function useBudgetSummary(brandId: string, month: string) {
  return useQuery({
    queryKey: [...SUMMARY_KEY, brandId, month],
    queryFn: async (): Promise<BudgetSummary> => {
      const result = await apiRequest<BudgetSummary>("/budget-summary", {
        searchParams: { brandId, month },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useBudgetCap(brandId: string, month: string) {
  return useQuery({
    queryKey: [...CAPS_KEY, brandId, month],
    queryFn: async (): Promise<BudgetCap | null> => {
      const result = await apiRequest<BudgetCap | null>("/budget-caps", {
        searchParams: { brandId, month },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export interface UpsertBudgetCapInput {
  brandId: string;
  month: string;
  totalCap: number;
  categoryCaps?: Partial<Record<BudgetCategory, number>>;
  notes?: string | null;
}

export function useUpsertBudgetCap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertBudgetCapInput): Promise<BudgetCap> => {
      const result = await apiRequest<BudgetCap>("/budget-caps", {
        method: "POST",
        body: input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (cap) => {
      queryClient.invalidateQueries({ queryKey: CAPS_KEY });
      queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
      queryClient.invalidateQueries({ queryKey: ["today-summary"] });
      logger.info("budget cap upserted", { month: cap.month, totalCap: cap.totalCap });
    },
  });
}

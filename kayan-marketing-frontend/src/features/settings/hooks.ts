import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../utils/api-client";
import type {
  BrandDna,
  UpdateBrandDnaInput,
  BrandDnaHistoryEntry,
  BrandDnaHistoryDetail,
} from "./types";
import { logger } from "../../utils/logger";

const DNA_KEY = ["brand-dna"] as const;
const HISTORY_KEY = ["brand-dna-history"] as const;

export function useBrandDna() {
  return useQuery({
    queryKey: DNA_KEY,
    queryFn: async (): Promise<BrandDna> => {
      const result = await apiRequest<BrandDna>("/brand-dna");
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useUpdateBrandDna() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateBrandDnaInput): Promise<unknown> => {
      const result = await apiRequest("/brand-dna", { method: "PATCH", body: input });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      // Invalidate both the DNA query and the history list (a save creates a
      // new history row). Also invalidate the legacy brand query so the
      // brand-voice form picks up any voiceConfig changes immediately.
      queryClient.invalidateQueries({ queryKey: DNA_KEY });
      queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
      queryClient.invalidateQueries({ queryKey: ["brand"] });
      logger.info("brand DNA updated");
    },
  });
}

export function useBrandDnaHistory(limit = 20) {
  return useQuery({
    queryKey: [...HISTORY_KEY, limit],
    queryFn: async (): Promise<BrandDnaHistoryEntry[]> => {
      const result = await apiRequest<BrandDnaHistoryEntry[]>(
        `/brand-dna/history?limit=${limit}`,
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useBrandDnaHistoryEntry(id: string | null) {
  return useQuery({
    queryKey: [...HISTORY_KEY, "detail", id],
    enabled: id !== null,
    queryFn: async (): Promise<BrandDnaHistoryDetail> => {
      const result = await apiRequest<BrandDnaHistoryDetail>(`/brand-dna/history/${id}`);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useRestoreBrandDna() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (historyId: string): Promise<unknown> => {
      const result = await apiRequest(`/brand-dna/restore/${historyId}`, { method: "POST" });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DNA_KEY });
      queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
      queryClient.invalidateQueries({ queryKey: ["brand"] });
      logger.info("brand DNA restored");
    },
  });
}

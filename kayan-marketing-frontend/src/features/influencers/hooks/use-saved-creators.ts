import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { Platform } from "../../../constants/influencer";
import type { SavedCreator } from "../../../types/influencer";

const SAVED_KEY = ["saved-creators"] as const;

// List the brand's saved creators, joined with creator_results so the
// page can render full creator cards without a second round trip.
export function useSavedCreators(platform?: Platform) {
  return useQuery({
    queryKey: [...SAVED_KEY, platform ?? "all"],
    queryFn: async (): Promise<SavedCreator[]> => {
      const result = await apiRequest<SavedCreator[]>("/saved-creators", {
        searchParams: platform ? { platform } : undefined,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

// POST /saved-creators. Idempotent on the backend — re-saving an already-
// saved creator returns the existing row.
export function useSaveCreator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (creatorResultId: string): Promise<SavedCreator> => {
      const result = await apiRequest<SavedCreator>("/saved-creators", {
        method: "POST",
        body: { creatorResultId },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SAVED_KEY });
    },
  });
}

// DELETE /saved-creators/:id. Optimistic — drops the row from cache before
// the request, restores on failure.
export function useRemoveSavedCreator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (savedId: string): Promise<void> => {
      const result = await apiRequest<null>(`/saved-creators/${savedId}`, {
        method: "DELETE",
      });
      if (!result.success) throw new Error(result.error.message);
    },
    onMutate: async (savedId) => {
      await qc.cancelQueries({ queryKey: SAVED_KEY });
      const previous = qc.getQueriesData<SavedCreator[]>({ queryKey: SAVED_KEY });
      // Drop the row optimistically from every cached saved-creators query
      // (one per platform filter variant we've fetched).
      qc.setQueriesData<SavedCreator[]>({ queryKey: SAVED_KEY }, (old) =>
        old ? old.filter((s) => s.id !== savedId) : old,
      );
      return { previous };
    },
    onError: (_err, _savedId, ctx) => {
      if (ctx?.previous) {
        for (const [key, data] of ctx.previous) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SAVED_KEY });
    },
  });
}

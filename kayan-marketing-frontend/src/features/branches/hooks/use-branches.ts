import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { Branch } from "../../../types/branch";

export function useBranches(brandId: string) {
  return useQuery({
    queryKey: ["branches", brandId],
    queryFn: async (): Promise<Branch[]> => {
      const result = await apiRequest<Branch[]>("/branches", {
        searchParams: { brandId },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 5 * 60_000,
  });
}

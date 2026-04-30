import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { Brand, BrandVoiceConfig } from "../../../types/brand";
import { logger } from "../../../utils/logger";

const BRAND_KEY = ["brand"] as const;

export function useBrand(brandId: string) {
  return useQuery({
    queryKey: [...BRAND_KEY, brandId],
    queryFn: async (): Promise<Brand> => {
      const result = await apiRequest<Brand>(`/brands/${brandId}`);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 60_000,
  });
}

export interface UpdateBrandInput {
  name?: string;
  primaryColor?: string | null;
  voiceConfig?: BrandVoiceConfig;
  dnaMarkdown?: string | null;
  instagramHandle?: string | null;
  tiktokHandle?: string | null;
  defaultShootCapacity?: number;
  defaultEditorOffset?: number;
  defaultSchedulingBuffer?: number;
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; input: UpdateBrandInput }): Promise<Brand> => {
      const result = await apiRequest<Brand>(`/brands/${args.id}`, {
        method: "PATCH",
        body: args.input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (brand) => {
      queryClient.invalidateQueries({ queryKey: BRAND_KEY });
      logger.info("brand updated", { id: brand.id });
    },
  });
}

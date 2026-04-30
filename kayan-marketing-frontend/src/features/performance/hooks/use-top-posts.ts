import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { TopPost } from "../../../types/performance";
import type { SocialPlatform } from "../../../constants/social-platform";
import { logger } from "../../../utils/logger";

const TOP_POSTS_KEY = ["top-posts"] as const;

type SortBy = "post_date" | "plays" | "likes" | "engagement_rate";

interface ListParams {
  brandId: string;
  from?: string;
  to?: string;
  platform?: SocialPlatform;
  sort?: SortBy;
}

export function useTopPosts(params: ListParams) {
  return useQuery({
    queryKey: [...TOP_POSTS_KEY, params],
    queryFn: async (): Promise<TopPost[]> => {
      const result = await apiRequest<TopPost[]>("/top-posts", {
        searchParams: {
          brandId: params.brandId,
          from: params.from,
          to: params.to,
          platform: params.platform,
          sort: params.sort,
        },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export interface CreateTopPostInput {
  brandId: string;
  entryId?: string | null;
  platform: SocialPlatform;
  postDate: string;
  captionSnippet?: string | null;
  plays?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  engagementRate?: number | null;
  thumbnailUrl?: string | null;
  postUrl?: string | null;
}

export function useCreateTopPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTopPostInput): Promise<TopPost> => {
      const result = await apiRequest<TopPost>("/top-posts", {
        method: "POST",
        body: input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: TOP_POSTS_KEY });
      logger.info("top post created", { id: post.id, platform: post.platform });
    },
  });
}

export function useDeleteTopPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const result = await apiRequest<null>(`/top-posts/${id}`, { method: "DELETE" });
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TOP_POSTS_KEY });
    },
  });
}

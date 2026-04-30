export type SocialPlatform = "tiktok" | "instagram" | "snapchat";

export interface PerformanceSnapshot {
  id: string;
  brandId: string;
  snapshotDate: string;
  platform: SocialPlatform;
  followers: number | null;
  totalViews: number | null;
  totalLikes: number | null;
  totalComments: number | null;
  totalShares: number | null;
  reach: number | null;
  notes: string | null;
  createdAt: string;
}

export interface TopPost {
  id: string;
  brandId: string;
  entryId: string | null;
  platform: SocialPlatform;
  postDate: string;
  captionSnippet: string | null;
  plays: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagementRate: number | null;
  thumbnailUrl: string | null;
  postUrl: string | null;
  createdAt: string;
}

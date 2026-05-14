import type { ContentFormat } from "../constants/content-formats";
import type { SocialPlatform } from "../constants/social-platform";
import type { TopicOccasion, TopicStatus } from "../constants/topics";
import type { PatternId } from "../constants/patterns";

// Mirrors the topics table after migration 0050.
// `format` (what kind of content) replaces `entry_type`. `default_platforms`
// holds which platforms a "Use this" conversion will publish to.
export interface Topic {
  id: string;
  brandId: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  patternId: PatternId | null;
  branchId: string | null;
  theme: string | null;
  occasion: TopicOccasion | null;
  format: ContentFormat;
  // Platforms the topic spawns into when used. Empty array for non-content formats.
  defaultPlatforms: SocialPlatform[];
  status: TopicStatus;
  priority: number;
  createdBy: string | null;
  usedAt: string | null;
  usedForEntryId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Input contracts. Mirror the backend Zod schemas in
// kayan-marketing-backend/supabase/functions/topics/index.ts — keep them in sync.

export interface CreateTopicInput {
  brandId: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  patternId?: PatternId | null;
  branchId?: string | null;
  theme?: string | null;
  occasion?: TopicOccasion | null;
  format: ContentFormat;
  defaultPlatforms: SocialPlatform[];
  priority?: number;
  notes?: string | null;
}

export interface UpdateTopicInput {
  title?: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  patternId?: PatternId | null;
  branchId?: string | null;
  theme?: string | null;
  occasion?: TopicOccasion | null;
  format?: ContentFormat;
  defaultPlatforms?: SocialPlatform[];
  priority?: number;
  notes?: string | null;
  status?: TopicStatus;
}

export interface UseTopicInput {
  targetDate: string;
  assignee: "junaid" | "ammar" | "both";
  shootDate?: string | null;
  branchId?: string | null;
  campaignId?: string | null;
  // Override topic.default_platforms at conversion time. Omit to inherit
  // from the topic.
  platformsOverride?: SocialPlatform[];
  titleOverride?: string;
  descriptionOverride?: string | null;
  productionMode?: "batch" | "adhoc";
  editorDaysOffset?: number;
  autoCreateTasks?: boolean;
}

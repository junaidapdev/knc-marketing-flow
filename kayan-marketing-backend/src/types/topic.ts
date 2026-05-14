import type { ContentFormat, Platform } from "../constants/entry-types";
import type { TopicOccasion, TopicStatus } from "../constants/topics";
import type { PatternId } from "../constants/patterns";

// Mirrors the topics table after migration 0050. `format` (what kind of
// content) replaces `entry_type`. `default_platforms` holds the platforms
// the topic spawns into when "Use this" is clicked.
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
  defaultPlatforms: Platform[];
  status: TopicStatus;
  priority: number;
  createdBy: string | null;
  usedAt: string | null;
  usedForEntryId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

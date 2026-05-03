import type { EntryType } from "../constants/entry-types";
import type { TopicOccasion, TopicStatus } from "../constants/topics";
import type { PatternId } from "../constants/patterns";

// Mirrors the topics table created by migration 0030. Camel-cased — the
// snake_case → camelCase transform happens at the API boundary
// (_shared/case.ts on the backend), so frontend code never sees snake.
export interface Topic {
  id: string;
  brandId: string;
  title: string;
  description: string | null;
  // Stored as text in the DB (no FK). The frontend type narrows it to known
  // PatternId values; unknown patterns from the future will fail this type
  // and need a constants update — that's the intended forcing function.
  patternId: PatternId | null;
  branchId: string | null;
  theme: string | null;
  occasion: TopicOccasion | null;
  entryType: EntryType;
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
// kayan-marketing-backend/src/validation/topics.ts — keep them in sync.

export interface CreateTopicInput {
  brandId: string;
  title: string;
  description?: string | null;
  patternId?: PatternId | null;
  branchId?: string | null;
  theme?: string | null;
  occasion?: TopicOccasion | null;
  entryType: EntryType;
  priority?: number;
  notes?: string | null;
}

export interface UpdateTopicInput {
  title?: string;
  description?: string | null;
  patternId?: PatternId | null;
  branchId?: string | null;
  theme?: string | null;
  occasion?: TopicOccasion | null;
  entryType?: EntryType;
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
  titleOverride?: string;
  descriptionOverride?: string | null;
  productionMode?: "batch" | "adhoc";
  editorDaysOffset?: number;
  autoCreateTasks?: boolean;
}

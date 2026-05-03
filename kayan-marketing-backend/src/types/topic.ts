import type { EntryType } from "../constants/entry-types";
import type { TopicOccasion, TopicStatus } from "../constants/topics";
import type { PatternId } from "../constants/patterns";

// Mirrors the topics table created by migration 0030. Camel-cased — the
// snake_case → camelCase transform happens at the API boundary
// (_shared/case.ts on the backend).
export interface Topic {
  id: string;
  brandId: string;
  title: string;
  description: string | null;
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

import type { EntryType } from "../constants/entry-types";
import type { BudgetCategory } from "../constants/budget-categories";
import type { Assignee } from "../constants/task-chains";
import type { PatternId } from "../constants/patterns";

export type EntryStatus = "planned" | "in_progress" | "live" | "done" | "cancelled";
export type ProductionMode = "batch" | "adhoc";

export interface Attachment {
  name: string;
  url: string;
  type: string;
}

export interface CalendarEntry {
  id: string;
  brandId: string;
  campaignId: string | null;
  branchId: string | null;
  type: EntryType;
  title: string;
  description: string | null;
  targetDate: string;
  assignee: Assignee;
  status: EntryStatus;
  budgetAllocated: number;
  budgetSpent: number;
  budgetCategory: BudgetCategory | null;
  videoUrl: string | null;
  postUrl: string | null;
  attachments: Attachment[];
  notes: string | null;
  metadata: Record<string, unknown>;
  // Authoring fields (migration 0020).
  script: string | null;
  // Production direction list (migration 0043) — separate field from
  // script so the spoken talent copy stays clean.
  shotDirections: string | null;
  caption: string | null;
  hashtags: string | null;
  // Production rhythm (migration 0025).
  productionMode: ProductionMode;
  shootDate: string | null;
  editorDaysOffset: number;
  // Recipe Book V2 tagging (migration 0029).
  patternId: PatternId | null;
  theme: string | null;
  // Topic queue trace (migration 0031).
  sourceTopicId: string | null;
  createdAt: string;
  updatedAt: string;
}

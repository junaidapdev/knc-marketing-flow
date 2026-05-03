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

export interface EntryBranchSummary {
  id: string;
  name: string;
  city: string;
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
  // Authoring fields filled in after the entry is planned. The Add Entry
  // modal does not write these — only the Entry Detail Panel's Content
  // section does (auto-saves on blur).
  script: string | null;
  caption: string | null;
  hashtags: string | null;
  // Production rhythm — see migration 0025 / Settings → Production rhythm.
  // Batch entries are made on a `shootDate`; ad-hoc entries skip it.
  productionMode: ProductionMode;
  shootDate: string | null;
  editorDaysOffset: number;
  // Recipe Book V2 tagging — added in migration 0029. Both nullable.
  // patternId: which of the 9 winning patterns (P1–P9) this entry follows.
  // theme: free-form focus product/topic for AI-targeted generation.
  patternId: PatternId | null;
  theme: string | null;
  // Trace which topic spawned this entry (migration 0031). Null for entries
  // created directly without going through the topics queue.
  sourceTopicId: string | null;
  createdAt: string;
  updatedAt: string;
  // Slim task summary inlined by GET /calendar-entries (list response). Used
  // by the calendar to render production phase pills without a per-entry
  // round-trip. Detail responses overlay full Task[] via EntryWithTasks.
  tasks?: EntryTaskSummary[];
  // Populated by GET /calendar-entries/:id (joined from branches table); null on list responses.
  branch?: EntryBranchSummary | null;
}

export interface EntryTaskSummary {
  id: string;
  phase: string;
  status: "pending" | "in_progress" | "completed";
  dueDate: string;
  title: string;
  assignee: string;
}

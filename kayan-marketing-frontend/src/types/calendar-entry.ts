import type { ContentFormat } from "../constants/content-formats";
import type { BudgetCategory } from "../constants/budget-categories";
import type { Assignee } from "../constants/task-chains";
import type { PatternId } from "../constants/patterns";
import type { EntryPublication, EntryPublicationFull } from "./entry-publication";

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
  influencerId: string | null;
  // What kind of content this entry represents (video, story, shop_activity, …).
  // Replaces the old `type` field — see migration 0050.
  format: ContentFormat;
  title: string;
  description: string | null;
  targetDate: string;
  assignee: Assignee;
  status: EntryStatus;
  budgetAllocated: number;
  budgetSpent: number;
  budgetCategory: BudgetCategory | null;
  // Master / raw video URL (not platform-specific). Per-platform public URLs
  // live in `publications` below.
  videoUrl: string | null;
  attachments: Attachment[];
  notes: string | null;
  metadata: Record<string, unknown>;
  // Authoring fields filled in after the entry is planned.
  script: string | null;
  shotDirections: string | null;
  caption: string | null;
  hashtags: string | null;
  // Production rhythm — see migration 0025 / Settings → Production rhythm.
  productionMode: ProductionMode;
  shootDate: string | null;
  editorDaysOffset: number;
  // Recipe Book V2 tagging — added in migration 0029. Both nullable.
  patternId: PatternId | null;
  theme: string | null;
  // Trace which topic spawned this entry (migration 0031). Null for entries
  // created directly without going through the topics queue.
  sourceTopicId: string | null;
  createdAt: string;
  updatedAt: string;
  // Slim task summary inlined by GET /calendar-entries (list response).
  tasks?: EntryTaskSummary[];
  // Populated by GET /calendar-entries/:id (joined from branches); null on list.
  branch?: EntryBranchSummary | null;
  // Per-platform publication rows. Present on every video/story entry; empty
  // array for non-content formats. List endpoint returns the slim shape;
  // detail endpoint returns the Full shape with timestamps.
  publications: EntryPublication[] | EntryPublicationFull[];
}

export interface EntryTaskSummary {
  id: string;
  phase: string;
  status: "pending" | "in_progress" | "completed";
  dueDate: string;
  title: string;
  assignee: string;
}

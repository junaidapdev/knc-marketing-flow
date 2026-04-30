import type { EntryType } from "../constants/entry-types";
import type { BudgetCategory } from "../constants/budget-categories";
import type { Assignee } from "../constants/task-chains";

export type EntryStatus = "planned" | "in_progress" | "live" | "done" | "cancelled";

export interface Attachment {
  name: string;
  url: string;
  type: string;
}

export interface CalendarEntry {
  id: string;
  brandId: string;
  campaignId: string | null;
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
  createdAt: string;
  updatedAt: string;
}

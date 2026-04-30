import type { TaskPhase, Assignee } from "../constants/task-chains";

export type TaskStatus = "pending" | "in_progress" | "completed";

export interface Task {
  id: string;
  entryId: string | null;
  campaignId: string | null;
  title: string;
  phase: TaskPhase | null;
  assignee: Assignee;
  dueDate: string;
  status: TaskStatus;
  isStandalone: boolean;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type { TaskPhase, Assignee };

import { z } from "zod";

const ASSIGNEE_VALUES = ["junaid", "ammar"] as const;
const TASK_STATUS_VALUES = ["pending", "in_progress", "completed"] as const;
const TASK_PHASE_VALUES = [
  "script",
  "shoot",
  "edit",
  "post",
  "plan",
  "setup",
  "wrap",
  "brief",
  "review",
  "track",
  "communicate",
  "activate",
  "custom",
] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createTaskSchema = z
  .object({
    entryId: z.string().uuid().nullable().optional(),
    campaignId: z.string().uuid().nullable().optional(),
    title: z.string().min(3).max(200),
    phase: z.enum(TASK_PHASE_VALUES).nullable().optional(),
    assignee: z.enum(ASSIGNEE_VALUES),
    dueDate: z.string().regex(DATE_REGEX, "Must be YYYY-MM-DD"),
    isStandalone: z.boolean().default(false),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine((data) => data.entryId != null || data.isStandalone === true, {
    message: "Task must reference an entry or be marked standalone.",
    path: ["entryId"],
  });

export const updateTaskSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  phase: z.enum(TASK_PHASE_VALUES).nullable().optional(),
  assignee: z.enum(ASSIGNEE_VALUES).optional(),
  dueDate: z.string().regex(DATE_REGEX, "Must be YYYY-MM-DD").optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

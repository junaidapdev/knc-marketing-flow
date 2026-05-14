import { CONTENT_FORMATS, type ContentFormat } from "./content-formats";

export type TaskPhase =
  | "script"
  | "shoot"
  | "edit"
  | "post"
  | "schedule"
  | "plan"
  | "setup"
  | "wrap"
  | "brief"
  | "review"
  | "track"
  | "communicate"
  | "activate"
  | "custom";

export type Assignee = "junaid" | "ammar" | "both";

export const ASSIGNEE_VALUES = ["junaid", "ammar", "both"] as const satisfies readonly Assignee[];

// Display labels for the 3-way assignee picker. The "both" option means the
// task / entry is co-owned and shows up in both Junaid's and Ammar's dockets.
export const ASSIGNEE_LABELS: Record<Assignee, string> = {
  junaid: "Junaid",
  ammar: "Ammar",
  both: "Junaid + Ammar",
};

// Cycles through the three states; used by the clickable assignee chip on
// the Add Entry modal's task preview rows.
export function nextAssignee(current: Assignee): Assignee {
  if (current === "junaid") return "ammar";
  if (current === "ammar") return "both";
  return "junaid";
}

export interface TaskTemplate {
  phase: TaskPhase;
  title: string;
  offsetDays: number;
  defaultAssignee: Assignee;
}

// Task chains keyed by FORMAT (not by platform-type). After migration 0050,
// one shoot = one entry that may land on multiple platforms — the chain is
// the same regardless of platform set ("Post across platforms" not "Post to
// TikTok").
export const TASK_CHAINS: Record<ContentFormat, TaskTemplate[]> = {
  [CONTENT_FORMATS.VIDEO]: [
    { phase: "script", title: "Write script", offsetDays: -4, defaultAssignee: "ammar" },
    { phase: "shoot", title: "Shoot footage", offsetDays: -2, defaultAssignee: "junaid" },
    { phase: "edit", title: "Edit video", offsetDays: -1, defaultAssignee: "ammar" },
    { phase: "post", title: "Post across platforms", offsetDays: 0, defaultAssignee: "junaid" },
  ],
  [CONTENT_FORMATS.STORY]: [
    { phase: "post", title: "Post stories", offsetDays: 0, defaultAssignee: "ammar" },
  ],
  [CONTENT_FORMATS.SHOP_ACTIVITY]: [
    { phase: "plan", title: "Plan & brief staff", offsetDays: -3, defaultAssignee: "junaid" },
    { phase: "setup", title: "Setup branch", offsetDays: 0, defaultAssignee: "junaid" },
    { phase: "wrap", title: "Wrap & document", offsetDays: 1, defaultAssignee: "junaid" },
  ],
  [CONTENT_FORMATS.INFLUENCER_COLLAB]: [
    { phase: "brief", title: "Brief & contract", offsetDays: -7, defaultAssignee: "junaid" },
    { phase: "review", title: "Content review", offsetDays: -2, defaultAssignee: "junaid" },
    { phase: "track", title: "Post & track", offsetDays: 0, defaultAssignee: "junaid" },
  ],
  [CONTENT_FORMATS.OFFER]: [
    { phase: "plan", title: "Plan offer", offsetDays: -3, defaultAssignee: "junaid" },
    { phase: "communicate", title: "Communicate to staff", offsetDays: -1, defaultAssignee: "junaid" },
    { phase: "activate", title: "Activate offer", offsetDays: 0, defaultAssignee: "junaid" },
    { phase: "wrap", title: "Wrap & log results", offsetDays: 3, defaultAssignee: "junaid" },
  ],
  [CONTENT_FORMATS.GENERAL]: [],
};

export interface PreviewTask {
  phase: TaskPhase;
  title: string;
  dueDate: string;
  assignee: Assignee;
}

export function computeTaskChain(format: ContentFormat, targetDate: string): PreviewTask[] {
  const templates = TASK_CHAINS[format] ?? [];
  return templates.map((t) => ({
    phase: t.phase,
    title: t.title,
    dueDate: addDays(targetDate, t.offsetDays),
    assignee: t.defaultAssignee,
  }));
}

// Batch-mode chain for video entries. Mirrors the backend logic in
// supabase/functions/calendar-entries/index.ts so the modal preview matches
// what'll actually be saved. Only used when productionMode === "batch" AND
// format === "video"; everything else falls back to computeTaskChain.
export function computeBatchVideoChain(args: {
  shootDate: string;
  targetDate: string;
  editorDaysOffset: number;
  schedulingBuffer: number;
}): PreviewTask[] {
  const { shootDate, targetDate, editorDaysOffset, schedulingBuffer } = args;
  return [
    {
      phase: "script",
      title: "Write script",
      dueDate: addDays(shootDate, -1),
      assignee: "ammar",
    },
    { phase: "shoot", title: "Shoot footage", dueDate: shootDate, assignee: "junaid" },
    {
      phase: "edit",
      title: "Edit video",
      dueDate: addDays(shootDate, editorDaysOffset),
      assignee: "ammar",
    },
    {
      phase: "schedule",
      title: "Schedule across platforms",
      dueDate: addDays(targetDate, -schedulingBuffer),
      assignee: "junaid",
    },
  ];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

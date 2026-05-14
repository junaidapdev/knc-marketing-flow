import { CONTENT_FORMATS, type ContentFormat } from "./entry-types";

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

export type Assignee = "junaid" | "ammar";

export interface TaskTemplate {
  phase: TaskPhase;
  title: string;
  offsetDays: number;
  defaultAssignee: Assignee;
}

// Task chains keyed by FORMAT (not platform). After migration 0050 one shoot
// = one entry across many platforms — the chain doesn't care which platforms.
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

import { ENTRY_TYPES, type EntryType } from "./entry-types";

export type TaskPhase =
  | "script"
  | "shoot"
  | "edit"
  | "post"
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

export const TASK_CHAINS: Record<EntryType, TaskTemplate[]> = {
  [ENTRY_TYPES.TIKTOK_VIDEO]: [
    { phase: "script", title: "Write script", offsetDays: -4, defaultAssignee: "ammar" },
    { phase: "shoot", title: "Shoot footage", offsetDays: -2, defaultAssignee: "junaid" },
    { phase: "edit", title: "Edit video", offsetDays: -1, defaultAssignee: "ammar" },
    { phase: "post", title: "Post to TikTok", offsetDays: 0, defaultAssignee: "junaid" },
  ],
  [ENTRY_TYPES.INSTAGRAM_REEL]: [
    { phase: "script", title: "Write script", offsetDays: -4, defaultAssignee: "ammar" },
    { phase: "shoot", title: "Shoot footage", offsetDays: -2, defaultAssignee: "junaid" },
    { phase: "edit", title: "Edit reel", offsetDays: -1, defaultAssignee: "ammar" },
    { phase: "post", title: "Post to Instagram", offsetDays: 0, defaultAssignee: "junaid" },
  ],
  [ENTRY_TYPES.INSTAGRAM_STORY]: [
    { phase: "post", title: "Post Instagram story", offsetDays: 0, defaultAssignee: "ammar" },
  ],
  [ENTRY_TYPES.SNAPCHAT_STORY]: [
    { phase: "post", title: "Post Snapchat story", offsetDays: 0, defaultAssignee: "ammar" },
  ],
  [ENTRY_TYPES.SHOP_ACTIVITY]: [
    { phase: "plan", title: "Plan & brief staff", offsetDays: -3, defaultAssignee: "junaid" },
    { phase: "setup", title: "Setup branch", offsetDays: 0, defaultAssignee: "junaid" },
    { phase: "wrap", title: "Wrap & document", offsetDays: 1, defaultAssignee: "junaid" },
  ],
  [ENTRY_TYPES.INFLUENCER_COLLAB]: [
    { phase: "brief", title: "Brief & contract", offsetDays: -7, defaultAssignee: "junaid" },
    { phase: "review", title: "Content review", offsetDays: -2, defaultAssignee: "junaid" },
    { phase: "track", title: "Post & track", offsetDays: 0, defaultAssignee: "junaid" },
  ],
  [ENTRY_TYPES.OFFER]: [
    { phase: "plan", title: "Plan offer", offsetDays: -3, defaultAssignee: "junaid" },
    { phase: "communicate", title: "Communicate to staff", offsetDays: -1, defaultAssignee: "junaid" },
    { phase: "activate", title: "Activate offer", offsetDays: 0, defaultAssignee: "junaid" },
    { phase: "wrap", title: "Wrap & log results", offsetDays: 3, defaultAssignee: "junaid" },
  ],
  [ENTRY_TYPES.GENERAL]: [],
};

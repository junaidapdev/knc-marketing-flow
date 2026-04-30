import type { CalendarEntry, EntryTaskSummary } from "../../types/calendar-entry";

// Derived production phase for an entry — what state of production is it in
// "right now," computed from its task statuses. Used to render the phase
// pill on calendar chips and the "what kind of day is today" banner.

export type DerivedPhaseKey =
  | "scripting"
  | "shooting"
  | "shoot_today"
  | "editing"
  | "ready_to_schedule"
  | "scheduling_today"
  | "scheduled"
  | "live"
  | "done"
  | "planning"
  | "in_production" // catch-all for legacy / non-batchable types
  | "no_tasks";

export interface DerivedPhase {
  key: DerivedPhaseKey;
  label: string;
  // Tailwind text + bg classes for the pill. Kept in this file so the visual
  // language stays consistent across calendar chips, today banner, etc.
  pillClass: string;
}

const PHASE_TO_DISPLAY: Record<DerivedPhaseKey, { label: string; pillClass: string }> = {
  scripting: { label: "Scripting", pillClass: "bg-cream-2 text-ink-2" },
  shooting: { label: "Shoot soon", pillClass: "bg-yellow-bg text-ink-2" },
  shoot_today: { label: "Shoot today", pillClass: "bg-yellow text-obsidian" },
  editing: { label: "Editing", pillClass: "bg-rose/40 text-rose-deep" },
  ready_to_schedule: { label: "Ready to schedule", pillClass: "bg-sage/40 text-sage-deep" },
  scheduling_today: { label: "Schedule today", pillClass: "bg-obsidian text-yellow" },
  scheduled: { label: "Scheduled", pillClass: "bg-sage/40 text-sage-deep" },
  live: { label: "Live", pillClass: "bg-obsidian text-yellow" },
  done: { label: "Done", pillClass: "bg-cream-2 text-ink-3" },
  planning: { label: "Planning", pillClass: "bg-cream-2 text-ink-3" },
  in_production: { label: "In production", pillClass: "bg-cream-2 text-ink-2" },
  no_tasks: { label: "No tasks", pillClass: "bg-cream-2 text-ink-3" },
};

function toDisplay(key: DerivedPhaseKey): DerivedPhase {
  const meta = PHASE_TO_DISPLAY[key];
  return { key, label: meta.label, pillClass: meta.pillClass };
}

// Order of phases for the batch video chain. Used to find the "first
// pending" phase — i.e. the next thing the team is waiting on.
const BATCH_PHASE_ORDER: readonly string[] = ["script", "shoot", "edit", "schedule"];

function findFirstPending(tasks: EntryTaskSummary[]): EntryTaskSummary | null {
  for (const phase of BATCH_PHASE_ORDER) {
    const t = tasks.find((tt) => tt.phase === phase && tt.status !== "completed");
    if (t) return t;
  }
  // Fallback: any non-completed task in any phase order
  return tasks.find((t) => t.status !== "completed") ?? null;
}

export function derivePhase(entry: CalendarEntry, today: string): DerivedPhase {
  // Entries already marked done/cancelled trump everything else.
  if (entry.status === "done") return toDisplay("done");
  if (entry.status === "cancelled") return toDisplay("done");
  if (entry.status === "live") return toDisplay("live");

  const tasks = entry.tasks ?? [];
  if (tasks.length === 0) return toDisplay("no_tasks");

  const allDone = tasks.every((t) => t.status === "completed");
  if (allDone) {
    // All tasks complete — content is queued, waiting for live date.
    return entry.targetDate <= today ? toDisplay("live") : toDisplay("scheduled");
  }

  const firstPending = findFirstPending(tasks);
  if (!firstPending) return toDisplay("in_production");

  const isToday = firstPending.dueDate === today;

  switch (firstPending.phase) {
    case "script":
      return toDisplay("scripting");
    case "shoot":
      return toDisplay(isToday ? "shoot_today" : "shooting");
    case "edit":
      return toDisplay("editing");
    case "schedule":
    case "post":
      return toDisplay(isToday ? "scheduling_today" : "ready_to_schedule");
    case "plan":
    case "brief":
      return toDisplay("planning");
    default:
      return toDisplay("in_production");
  }
}

// Aggregate phase counts for a list of entries on a given day. Powers the
// "what kind of day is today" banner — we look at *tasks due today* across
// all entries, not entry-level phases.
export interface DayPhaseCounts {
  shoot: number;
  script: number;
  edit: number;
  schedule: number;
  other: number;
  total: number;
}

export function countTasksDueOnDay(
  entries: CalendarEntry[],
  day: string,
): DayPhaseCounts {
  const acc: DayPhaseCounts = { shoot: 0, script: 0, edit: 0, schedule: 0, other: 0, total: 0 };
  for (const entry of entries) {
    const tasks = entry.tasks ?? [];
    for (const t of tasks) {
      if (t.dueDate !== day) continue;
      if (t.status === "completed") continue;
      acc.total += 1;
      if (t.phase === "shoot") acc.shoot += 1;
      else if (t.phase === "script") acc.script += 1;
      else if (t.phase === "edit") acc.edit += 1;
      else if (t.phase === "schedule" || t.phase === "post") acc.schedule += 1;
      else acc.other += 1;
    }
  }
  return acc;
}

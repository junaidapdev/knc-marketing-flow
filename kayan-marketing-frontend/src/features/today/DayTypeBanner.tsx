import { Clapperboard, FileText, Scissors, Send, Coffee, Sparkles } from "lucide-react";
import type { Task } from "../../types/task";

interface Props {
  tasks: Task[];
}

interface DayPhaseCounts {
  shoot: number;
  script: number;
  edit: number;
  schedule: number;
  other: number;
  total: number;
}

function countByPhase(tasks: Task[]): DayPhaseCounts {
  const acc: DayPhaseCounts = { shoot: 0, script: 0, edit: 0, schedule: 0, other: 0, total: 0 };
  for (const t of tasks) {
    if (t.status === "completed") continue;
    acc.total += 1;
    switch (t.phase) {
      case "shoot":
        acc.shoot += 1;
        break;
      case "script":
        acc.script += 1;
        break;
      case "edit":
        acc.edit += 1;
        break;
      case "schedule":
      case "post":
        acc.schedule += 1;
        break;
      default:
        acc.other += 1;
    }
  }
  return acc;
}

// Decide which "kind of day" headline best describes today, based on which
// phase is most prominent. The banner is opinionated — if shoot tasks exist,
// today is a "Shoot day" first and foremost (because being on set displaces
// every other workflow). Otherwise the banner picks the next most relevant
// phase, falling back to a generic "active day" or "quiet day."
function pickHeadline(c: DayPhaseCounts): {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: "shoot" | "script" | "edit" | "schedule" | "mixed" | "quiet";
} {
  if (c.total === 0) {
    return {
      icon: <Coffee size={18} />,
      title: "Quiet day",
      description: "No tasks on the docket. A good day for planning next week.",
      tone: "quiet",
    };
  }
  if (c.shoot > 0) {
    return {
      icon: <Clapperboard size={18} />,
      title: c.shoot === 1 ? "Shoot day" : `Shoot day · ${c.shoot} entries`,
      description: extras(c, "shoot"),
      tone: "shoot",
    };
  }
  if (c.schedule > 0) {
    return {
      icon: <Send size={18} />,
      title:
        c.schedule === 1
          ? "Schedule today"
          : `Schedule day · ${c.schedule} to queue`,
      description: extras(c, "schedule"),
      tone: "schedule",
    };
  }
  if (c.edit > 0) {
    return {
      icon: <Scissors size={18} />,
      title: c.edit === 1 ? "Editing day" : `Editing day · ${c.edit} to review`,
      description: extras(c, "edit"),
      tone: "edit",
    };
  }
  if (c.script > 0) {
    return {
      icon: <FileText size={18} />,
      title: c.script === 1 ? "Scripting day" : `Scripting day · ${c.script} scripts`,
      description: extras(c, "script"),
      tone: "script",
    };
  }
  return {
    icon: <Sparkles size={18} />,
    title: `Active day · ${c.other} tasks`,
    description: "Mixed work — campaigns, shop activities, or one-offs.",
    tone: "mixed",
  };
}

// Build the secondary "and also…" line that mentions any non-headline
// phases that have work today. Keeps the headline crisp while still
// flagging the rest of the day's load.
function extras(c: DayPhaseCounts, headline: keyof DayPhaseCounts): string {
  const others: string[] = [];
  if (headline !== "shoot" && c.shoot > 0) others.push(`${c.shoot} shoot`);
  if (headline !== "script" && c.script > 0) others.push(`${c.script} script`);
  if (headline !== "edit" && c.edit > 0) others.push(`${c.edit} edit`);
  if (headline !== "schedule" && c.schedule > 0) others.push(`${c.schedule} schedule`);
  if (c.other > 0) others.push(`${c.other} other`);
  if (others.length === 0) return "";
  return `Also today: ${others.join(", ")}.`;
}

const TONE_STYLES: Record<
  "shoot" | "script" | "edit" | "schedule" | "mixed" | "quiet",
  string
> = {
  shoot: "bg-yellow-bg border-yellow/50 text-ink",
  script: "bg-cream-2/70 border-line text-ink",
  edit: "bg-rose/30 border-rose-deep/30 text-ink",
  schedule: "bg-obsidian text-yellow border-obsidian",
  mixed: "bg-cream-2/60 border-line text-ink",
  quiet: "bg-cream-2/40 border-line text-ink-2",
};

export function DayTypeBanner({ tasks }: Props): JSX.Element {
  const counts = countByPhase(tasks);
  const headline = pickHeadline(counts);
  const style = TONE_STYLES[headline.tone];

  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-4 py-3 mb-5 ${style}`}
      role="status"
      aria-live="polite"
    >
      <span className="flex-shrink-0 opacity-90">{headline.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-serif text-[15px] tracking-tight leading-tight">
          {headline.title}
        </div>
        {headline.description && (
          <div className="text-[12px] opacity-80 mt-0.5">{headline.description}</div>
        )}
      </div>
    </div>
  );
}

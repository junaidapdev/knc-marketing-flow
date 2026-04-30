import { format } from "date-fns";
import type { CalendarEntry } from "../../types/calendar-entry";
import { ENTRY_TYPE_COLORS } from "../../constants/entry-colors";
import { ASSIGNEE_LABELS } from "../../constants/task-chains";
import { isEntryContentReady, needsContentAuthoring } from "./content-helpers";
import { derivePhase } from "./derive-phase";

interface Props {
  entry: CalendarEntry;
  onClick: (entryId: string) => void;
  variant?: "compact" | "stacked";
}

export function EntryChip({ entry, onClick, variant = "compact" }: Props): JSX.Element {
  const colors = ENTRY_TYPE_COLORS[entry.type];
  const isStacked = variant === "stacked";
  const today = format(new Date(), "yyyy-MM-dd");
  const phase = derivePhase(entry, today);
  // The "in_production" / "no_tasks" / "planning" phases are non-actionable
  // — hide the pill when there's nothing useful to show.
  const showPhase = phase.key !== "no_tasks" && phase.key !== "in_production";

  // Content-readiness dot (script + caption written) — kept from the
  // previous design. Independent from the phase pill: the dot is about
  // whether *content* is authored, the pill is about *production state*.
  const showsDot = needsContentAuthoring(entry.type);
  const ready = showsDot && isEntryContentReady(entry);
  const dotTitle = !showsDot
    ? undefined
    : ready
      ? "Script / caption ready"
      : "Content not authored yet";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(entry.id);
      }}
      className={`w-full text-left rounded-md ${colors.bg} ${colors.text} hover:brightness-95 transition ${
        isStacked ? "px-2 py-1.5 text-[11.5px]" : "px-1.5 py-0.5 text-[10px] truncate"
      }`}
      title={entry.title}
    >
      {isStacked ? (
        <>
          <div className="flex items-center gap-1.5 leading-tight">
            {showsDot && (
              <span
                aria-label={dotTitle}
                title={dotTitle}
                className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  ready ? "bg-current opacity-90" : "bg-current opacity-30"
                }`}
              />
            )}
            <span className="font-semibold truncate">{entry.title}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] opacity-80">
              {ASSIGNEE_LABELS[entry.assignee] ?? entry.assignee}
            </span>
            {showPhase && (
              <span
                className={`text-[9.5px] font-semibold px-1.5 py-px rounded-full ${phase.pillClass}`}
                title={`Production phase: ${phase.label}`}
              >
                {phase.label}
              </span>
            )}
          </div>
        </>
      ) : (
        <span className="flex items-center gap-1 truncate">
          {showsDot && (
            <span
              aria-label={dotTitle}
              title={dotTitle}
              className={`inline-block w-1 h-1 rounded-full flex-shrink-0 ${
                ready ? "bg-current opacity-90" : "bg-current opacity-30"
              }`}
            />
          )}
          <span className="truncate font-medium">{entry.title}</span>
          {showPhase && (
            <span
              className={`flex-shrink-0 text-[8.5px] font-semibold px-1 py-px rounded-full ${phase.pillClass}`}
              title={`Production phase: ${phase.label}`}
            >
              {phase.label}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

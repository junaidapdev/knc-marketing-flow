import { useMemo } from "react";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isToday } from "date-fns";
import { Clapperboard } from "lucide-react";
import { useCalendarEntries } from "./hooks/use-calendar-entries";
import { useTasks } from "../tasks/hooks/use-tasks";
import { EntryChip } from "./EntryChip";
import { ASSIGNEE_LABELS } from "../../constants/task-chains";
import { useCurrentBrand } from "../../hooks/use-current-brand";
import { useBrand } from "../brand/hooks/use-brand";
import type { CalendarEntry } from "../../types/calendar-entry";
import type { Task } from "../../types/task";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  cursor: Date;
  branchId: string | null;
  onOpenEntry: (entryId: string) => void;
  onAddOnDay: (day: Date) => void;
}

export function WeeklyView({ cursor, branchId, onOpenEntry, onAddOnDay }: Props): JSX.Element {
  const weekStart = startOfWeek(cursor, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(cursor, { weekStartsOn: 0 });
  const fromIso = format(weekStart, "yyyy-MM-dd");
  const toIso = format(weekEnd, "yyyy-MM-dd");

  const entries = useCalendarEntries({
    from: fromIso,
    to: toIso,
    branchId: branchId ?? undefined,
  });
  const tasks = useTasks({ from: fromIso, to: toIso });

  const days = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd],
  );

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    if (!entries.data) return map;
    for (const entry of entries.data) {
      const list = map.get(entry.targetDate);
      if (list) list.push(entry);
      else map.set(entry.targetDate, [entry]);
    }
    return map;
  }, [entries.data]);

  const pendingTasks: Task[] = useMemo(() => {
    if (!tasks.data) return [];
    return tasks.data.filter((t) => t.status !== "completed");
  }, [tasks.data]);

  // Count entries with shoot_date matching each day so we can mark shoot
  // days visually — same logic as MonthlyView.
  const shootCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    if (!entries.data) return map;
    for (const entry of entries.data) {
      if (!entry.shootDate) continue;
      map.set(entry.shootDate, (map.get(entry.shootDate) ?? 0) + 1);
    }
    return map;
  }, [entries.data]);

  const { brandId: currentBrandId } = useCurrentBrand();
  const brand = useBrand(currentBrandId);
  const shootCapacity = brand.data?.defaultShootCapacity ?? 4;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-4">
      <div className="rounded-lg border border-line overflow-hidden bg-paper">
        <div className="grid grid-cols-7 border-b border-line bg-cream-2/50">
          {days.map((day, i) => {
            const today = isToday(day);
            const dayKey = format(day, "yyyy-MM-dd");
            const shootCount = shootCountByDay.get(dayKey) ?? 0;
            const isShootDay = shootCount > 0;
            const isOverCapacity = shootCount > shootCapacity;
            return (
              <div
                key={day.toISOString()}
                className={`px-3 py-2.5 ${today ? "bg-yellow-bg/60" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="eyebrow">{WEEKDAY_LABELS[i]}</div>
                  {isShootDay && (
                    <span
                      className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        isOverCapacity
                          ? "bg-rose-deep/20 text-rose-deep"
                          : "bg-obsidian text-yellow"
                      }`}
                      title={`Shoot day · ${shootCount} ${shootCount === 1 ? "entry" : "entries"}${
                        isOverCapacity ? ` (over ${shootCapacity})` : ""
                      }`}
                    >
                      <Clapperboard size={9} />
                      {shootCount}
                    </span>
                  )}
                </div>
                <div
                  className={`text-[16px] font-serif tracking-tight mt-0.5 ${
                    today ? "text-ink font-semibold" : "text-ink"
                  }`}
                >
                  {format(day, "d MMM")}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-7 min-h-[500px]">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEntries = entriesByDay.get(key) ?? [];
            const today = isToday(day);
            const shootCount = shootCountByDay.get(key) ?? 0;
            const isShootDay = shootCount > 0;
            const isOverCapacity = shootCount > shootCapacity;
            return (
              <div
                key={key}
                className={`group flex flex-col gap-2 border-r border-line p-2.5 last:border-r-0 ${
                  today
                    ? "bg-yellow-bg/30"
                    : isShootDay
                      ? isOverCapacity
                        ? "bg-rose/10"
                        : "bg-yellow/10"
                      : ""
                }`}
              >
                {dayEntries.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onAddOnDay(day)}
                    className="flex-1 min-h-[60px] border border-dashed border-line-2 rounded-md text-ink-3 hover:text-ink hover:border-ink-2/30 text-[12px] flex items-center justify-center transition"
                  >
                    + Add
                  </button>
                ) : (
                  <>
                    {dayEntries.map((entry) => (
                      <EntryChip
                        key={entry.id}
                        entry={entry}
                        onClick={onOpenEntry}
                        variant="stacked"
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => onAddOnDay(day)}
                      className="opacity-0 group-hover:opacity-100 text-[11px] text-ink-3 hover:text-ink border border-dashed border-line-2 rounded-md py-1 transition"
                    >
                      + Add
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {entries.isError && (
          <div className="p-3 text-[13px] text-rose-deep border-t border-line">
            {entries.error instanceof Error ? entries.error.message : "Failed to load entries."}
          </div>
        )}
      </div>

      <aside className="card self-start">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="h-card-sm">Pending tasks</h3>
          <span className="text-[11.5px] text-ink-3">{pendingTasks.length}</span>
        </div>
        {pendingTasks.length === 0 ? (
          <p className="text-[12.5px] text-ink-3">All tasks completed for this week.</p>
        ) : (
          <ul className="space-y-3">
            {pendingTasks.map((t) => (
              <li key={t.id} className="border-b border-line last:border-b-0 pb-3 last:pb-0">
                <div className="text-[13px] font-medium text-ink truncate">{t.title}</div>
                <div className="text-[11.5px] text-ink-3 mt-0.5">
                  {t.dueDate} · <span>{ASSIGNEE_LABELS[t.assignee] ?? t.assignee}</span>
                  {t.phase && (
                    <>
                      <span className="mx-1">·</span>
                      <span className="capitalize">{t.phase}</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

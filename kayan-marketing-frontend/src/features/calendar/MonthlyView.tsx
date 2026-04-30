import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from "date-fns";
import { Clapperboard } from "lucide-react";
import { useCalendarEntries } from "./hooks/use-calendar-entries";
import { EntryChip } from "./EntryChip";
import { useCurrentBrand } from "../../hooks/use-current-brand";
import { useBrand } from "../brand/hooks/use-brand";
import type { CalendarEntry } from "../../types/calendar-entry";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS_PER_DAY = 3;

interface Props {
  cursor: Date;
  branchId: string | null;
  onOpenEntry: (entryId: string) => void;
  onDayClick: (day: Date) => void;
  onAddOnDay: (day: Date) => void;
}

export function MonthlyView({
  cursor,
  branchId,
  onOpenEntry,
  onDayClick,
  onAddOnDay,
}: Props): JSX.Element {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const entries = useCalendarEntries({
    from: format(gridStart, "yyyy-MM-dd"),
    to: format(gridEnd, "yyyy-MM-dd"),
    branchId: branchId ?? undefined,
  });

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    if (!entries.data) return map;
    for (const entry of entries.data) {
      const key = entry.targetDate;
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
    }
    return map;
  }, [entries.data]);

  // A "shoot day" is any date that has ≥1 entry with shoot_date set to that
  // day. We render a small 🎬 marker + count so the marketer can scan the
  // month and see when production is happening.
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
    <div className="rounded-lg border border-line overflow-hidden bg-paper">
      <div className="grid grid-cols-7 bg-cream-2/50 border-b border-line">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-3 py-2.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-3 font-medium"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr min-h-[600px]">
        {days.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayEntries = entriesByDay.get(dayKey) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const shootCount = shootCountByDay.get(dayKey) ?? 0;
          const isShootDay = shootCount > 0;
          const isOverCapacity = shootCount > shootCapacity;

          return (
            <div
              key={dayKey}
              role="button"
              tabIndex={0}
              onClick={() => onDayClick(day)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDayClick(day);
                }
              }}
              className={`day-cell group relative flex flex-col items-stretch text-left border-b border-r border-line p-2 ${
                inMonth ? "" : "opacity-50 bg-cream-2/20"
              } ${
                today
                  ? "bg-yellow-bg/60"
                  : isShootDay
                    ? isOverCapacity
                      ? "bg-rose/20"
                      : "bg-yellow/10"
                    : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[12px] font-semibold ${
                    today
                      ? "h-[22px] w-[22px] inline-flex items-center justify-center rounded-full bg-obsidian text-yellow text-[11px]"
                      : "text-ink-2"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <div className="flex items-center gap-1">
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddOnDay(day);
                    }}
                    aria-label={`Add entry on ${dayKey}`}
                    className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-ink text-base leading-none px-1"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1 min-h-0">
                {dayEntries.slice(0, MAX_CHIPS_PER_DAY).map((entry) => (
                  <EntryChip
                    key={entry.id}
                    entry={entry}
                    onClick={onOpenEntry}
                    variant="compact"
                  />
                ))}
                {dayEntries.length > MAX_CHIPS_PER_DAY && (
                  <span className="text-[10px] text-ink-3 px-1">
                    +{dayEntries.length - MAX_CHIPS_PER_DAY} more
                  </span>
                )}
              </div>
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
  );
}

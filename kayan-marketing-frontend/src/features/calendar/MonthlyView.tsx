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
import { useMarketingEvents } from "../marketing-events/hooks";
import { EntryChip } from "./EntryChip";
import { useCurrentBrand } from "../../hooks/use-current-brand";
import { useBrand } from "../brand/hooks/use-brand";
import { FORMAT_COLORS } from "../../constants/entry-colors";
import type { CalendarEntry } from "../../types/calendar-entry";
import type { MarketingEvent, MarketingEventImportance } from "../../types/marketing-event";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS_PER_DAY = 3;
const MAX_EVENTS_PER_DAY = 2;

const EVENT_DOT_CLASS: Record<MarketingEventImportance, string> = {
  mega: "bg-obsidian",
  major: "bg-yellow",
  soft: "bg-sage-deep",
  reference: "bg-ink-3",
};

const EVENT_ROW_CLASS: Record<MarketingEventImportance, string> = {
  mega: "bg-obsidian text-yellow",
  major: "bg-yellow-bg text-obsidian border-yellow/50",
  soft: "bg-sage/25 text-[#2C5530] border-sage/60",
  reference: "bg-cream-2 text-ink-3 border-line",
};

function eventsForDay(events: MarketingEvent[] | undefined, dayKey: string): MarketingEvent[] {
  if (!events) return [];
  return events.filter((event) => event.startDate <= dayKey && event.endDate >= dayKey);
}

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

  const { brandId: currentBrandId } = useCurrentBrand();
  const marketingEvents = useMarketingEvents({
    brandId: currentBrandId,
    from: format(gridStart, "yyyy-MM-dd"),
    to: format(gridEnd, "yyyy-MM-dd"),
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

  const brand = useBrand(currentBrandId);
  const shootCapacity = brand.data?.defaultShootCapacity ?? 4;

  return (
    <div className="rounded-lg border border-line overflow-hidden bg-paper">
      <div className="grid grid-cols-7 bg-cream-2/50 border-b border-line">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 sm:px-3 py-2 sm:py-2.5 text-[9px] sm:text-[10.5px] uppercase tracking-[0.14em] text-ink-3 font-medium text-center sm:text-left"
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.charAt(0)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr min-h-[420px] sm:min-h-[600px]">
        {days.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayEntries = entriesByDay.get(dayKey) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const shootCount = shootCountByDay.get(dayKey) ?? 0;
          const isShootDay = shootCount > 0;
          const isOverCapacity = shootCount > shootCapacity;
          const dayEvents = eventsForDay(marketingEvents.data, dayKey);

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
              className={`day-cell group relative flex flex-col items-stretch text-left border-b border-r border-line p-1 sm:p-2 ${
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
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <span
                  className={`text-[11px] sm:text-[12px] font-semibold ${
                    today
                      ? "h-[18px] w-[18px] sm:h-[22px] sm:w-[22px] inline-flex items-center justify-center rounded-full bg-obsidian text-yellow text-[10px] sm:text-[11px]"
                      : "text-ink-2"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <div className="flex items-center gap-1">
                  {isShootDay && (
                    <span
                      className={`hidden sm:flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
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
                  {dayEvents.length > 0 && (
                    <span
                      className="hidden sm:flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-cream-2 text-ink-2"
                      title={dayEvents.map((event) => event.title).join(", ")}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${EVENT_DOT_CLASS[dayEvents[0]!.importance]}`} />
                      {dayEvents.length}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddOnDay(day);
                    }}
                    aria-label={`Add entry on ${dayKey}`}
                    className="hidden sm:block opacity-0 group-hover:opacity-100 text-ink-3 hover:text-ink text-base leading-none px-1"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Mobile: dot row + count, Desktop: chips */}
              <div className="sm:hidden flex flex-wrap gap-0.5 min-h-0">
                {dayEvents.slice(0, 2).map((event) => (
                  <span
                    key={event.id}
                    className={`w-1.5 h-1.5 rounded-full ${EVENT_DOT_CLASS[event.importance]}`}
                    aria-label={event.title}
                  />
                ))}
                {dayEntries.slice(0, 4).map((entry) => (
                  <span
                    key={entry.id}
                    className={`w-1.5 h-1.5 rounded-full ${
                      FORMAT_COLORS[entry.format].bg
                    }`}
                    aria-label={entry.title}
                  />
                ))}
                {dayEntries.length > 4 && (
                  <span className="text-[8.5px] text-ink-3 leading-none">
                    +{dayEntries.length - 4}
                  </span>
                )}
              </div>

              <div className="hidden sm:flex flex-col gap-1 min-h-0">
                {dayEvents.slice(0, MAX_EVENTS_PER_DAY).map((event) => (
                  <div
                    key={event.id}
                    className={`truncate rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold ${EVENT_ROW_CLASS[event.importance]}`}
                    title={event.marketingNotes ?? event.description ?? event.title}
                  >
                    {event.title}
                    {event.isDateEstimate ? " (est.)" : ""}
                  </div>
                ))}
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

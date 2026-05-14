import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { X, AlertCircle } from "lucide-react";
import { useCalendarEntries } from "./hooks/use-calendar-entries";
import {
  CONTENT_FORMATS,
  CONTENT_FORMAT_LABELS,
  type ContentFormat,
} from "../../constants/content-formats";
import type { CalendarEntry } from "../../types/calendar-entry";

type Filter = "all" | "videos" | "stories" | "overdue";

type Bucket = "done" | "in_progress" | "overdue" | "planned";

const BUCKET_DOT: Record<Bucket, string> = {
  done: "bg-sage-deep",
  in_progress: "bg-yellow",
  overdue: "bg-rose-deep",
  planned: "bg-cream-2 border border-line-2",
};

const BUCKET_LABEL: Record<Bucket, string> = {
  done: "done",
  in_progress: "in progress",
  overdue: "overdue",
  planned: "planned",
};

function bucketFor(e: CalendarEntry, today: string): Bucket {
  if (e.status === "done" || e.status === "live") return "done";
  if (e.status === "in_progress") return "in_progress";
  if (e.status === "cancelled") return "planned";
  if (e.targetDate < today) return "overdue";
  return "planned";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  videos: "Videos",
  stories: "Stories",
  overdue: "Overdue",
};

// Build a "TikTok • Instagram • Snap" subtitle for content entries so the
// sidebar surfaces multi-platform reach at a glance. Falls back to the
// format label for non-content entries.
function entrySubtitle(entry: CalendarEntry): string {
  if (
    entry.format === CONTENT_FORMATS.VIDEO ||
    entry.format === CONTENT_FORMATS.STORY
  ) {
    const platforms = (entry.publications ?? []).map((p) => p.platform);
    if (platforms.length === 0) return CONTENT_FORMAT_LABELS[entry.format];
    const labels = platforms.map((p) =>
      p === "tiktok" ? "TikTok" : p === "instagram" ? "IG" : "Snap",
    );
    return `${CONTENT_FORMAT_LABELS[entry.format]} · ${labels.join(" · ")}`;
  }
  return CONTENT_FORMAT_LABELS[entry.format];
}

interface Props {
  cursor: Date;
  branchId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEntry: (id: string) => void;
}

export function CalendarSidebar({
  cursor,
  branchId,
  isOpen,
  onClose,
  onOpenEntry,
}: Props): JSX.Element | null {
  const today = todayIso();
  const [filter, setFilter] = useState<Filter>("all");

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  // Pad to full weeks so "Week of …" sections always start on Sunday.
  const fromIso = format(startOfWeek(monthStart, { weekStartsOn: 0 }), "yyyy-MM-dd");
  const toIso = format(endOfWeek(monthEnd, { weekStartsOn: 0 }), "yyyy-MM-dd");
  const monthFromIso = format(monthStart, "yyyy-MM-dd");
  const monthToIso = format(monthEnd, "yyyy-MM-dd");

  const entries = useCalendarEntries({
    from: fromIso,
    to: toIso,
    branchId: branchId ?? undefined,
  });

  // Only count items whose target_date is within the cursor month for the
  // header counts; the list itself shows full weeks even if a few days
  // bleed into adjacent months.
  const monthOnly = useMemo(
    () =>
      (entries.data ?? []).filter(
        (e) => e.targetDate >= monthFromIso && e.targetDate <= monthToIso,
      ),
    [entries.data, monthFromIso, monthToIso],
  );

  const matchesFormatFilter = (e: CalendarEntry, f: Filter): boolean => {
    if (f === "videos") return e.format === CONTENT_FORMATS.VIDEO;
    if (f === "stories") return e.format === CONTENT_FORMATS.STORY;
    return true;
  };

  const filtered = useMemo(() => {
    return monthOnly.filter((e) => {
      if (filter === "overdue") return bucketFor(e, today) === "overdue";
      return matchesFormatFilter(e, filter);
    });
  }, [monthOnly, filter, today]);

  // Filter counts for badges on the pill row
  const counts = useMemo(() => {
    let videos = 0;
    let stories = 0;
    let overdue = 0;
    for (const e of monthOnly) {
      if (e.format === CONTENT_FORMATS.VIDEO) videos += 1;
      if (e.format === CONTENT_FORMATS.STORY) stories += 1;
      if (bucketFor(e, today) === "overdue") overdue += 1;
    }
    return { all: monthOnly.length, videos, stories, overdue };
  }, [monthOnly, today]);

  // Group by Sun-Sat week
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of filtered) {
      const date = new Date(e.targetDate + "T00:00:00");
      const wkStart = format(startOfWeek(date, { weekStartsOn: 0 }), "yyyy-MM-dd");
      const list = map.get(wkStart);
      if (list) list.push(e);
      else map.set(wkStart, [e]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.targetDate.localeCompare(b.targetDate));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (!isOpen) return null;

  // ContentFormat is unused at runtime here but keep the import alive for type
  // inference in entrySubtitle.
  void (null as unknown as ContentFormat);

  return (
    <>
      {/* Mobile backdrop — hidden on desktop where the panel sits beside the calendar */}
      <div
        className="lg:hidden fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-2 sm:inset-auto sm:top-4 sm:right-4 sm:bottom-4 sm:w-[360px] bg-paper border border-line rounded-lg shadow-lg z-50 flex flex-col text-ink overflow-hidden"
        aria-label="Bird's-eye view"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="min-w-0">
            <h2 className="font-serif text-[16px] tracking-tight text-ink leading-tight">
              Bird's-eye view
            </h2>
            <p className="text-[11.5px] text-ink-3 mt-0.5">
              {format(cursor, "MMMM yyyy")} · {filtered.length}
              {filter !== "all" && counts.all !== filtered.length && ` of ${counts.all}`}
              {" "}items
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid place-items-center w-8 h-8 rounded-[8px] text-ink-2 hover:bg-cream-2 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </header>

        {/* Filter pills */}
        <div className="px-4 py-2.5 flex flex-wrap gap-1.5 border-b border-line">
          {(["all", "videos", "stories", "overdue"] as const).map((f) => {
            const count = counts[f];
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition flex items-center gap-1.5 ${
                  active
                    ? "bg-obsidian text-yellow"
                    : "bg-cream-2 text-ink-2 hover:bg-cream"
                } ${f === "overdue" && count > 0 && !active ? "ring-1 ring-rose-deep/30" : ""}`}
              >
                <span>{FILTER_LABELS[f]}</span>
                <span
                  className={`text-[9.5px] px-1 rounded ${
                    active ? "bg-yellow/20" : "bg-paper text-ink-3"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Scroll list */}
        <div className="flex-1 overflow-y-auto canvas-scroll">
          {entries.isLoading && (
            <p className="text-ink-3 text-[13px] p-4">Loading…</p>
          )}
          {!entries.isLoading && counts.all === 0 && (
            <div className="p-4 text-center text-ink-3 text-[13px]">
              No entries scheduled this month.
            </div>
          )}
          {!entries.isLoading && counts.all > 0 && filtered.length === 0 && (
            <div className="p-4 text-center text-ink-3 text-[13px]">
              No {filter} items in this month.
            </div>
          )}
          {grouped.map(([wkStart, list]) => {
            const wkStartDate = new Date(wkStart + "T00:00:00");
            const wkEndDate = endOfWeek(wkStartDate, { weekStartsOn: 0 });
            return (
              <div key={wkStart} className="border-b border-line last:border-b-0">
                <div className="px-4 py-2 sticky top-0 bg-cream-2/70 backdrop-blur-sm z-10">
                  <div className="eyebrow text-[10px]">
                    Week of {format(wkStartDate, "MMM d")} – {format(wkEndDate, "d")}
                  </div>
                </div>
                <ul>
                  {list.map((e) => {
                    const b = bucketFor(e, today);
                    const date = new Date(e.targetDate + "T00:00:00");
                    return (
                      <li key={e.id}>
                        <button
                          onClick={() => onOpenEntry(e.id)}
                          title={`${e.title} — ${BUCKET_LABEL[b]}`}
                          className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-cream-2/40 transition border-b border-line/50 last:border-b-0"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${BUCKET_DOT[b]} flex-shrink-0`}
                          />
                          <div className="flex-shrink-0 w-[42px]">
                            <div className="text-[9.5px] uppercase tracking-wider text-ink-3 font-semibold leading-none">
                              {format(date, "EEE")}
                            </div>
                            <div className="text-[12px] text-ink-2 font-medium leading-tight mt-0.5">
                              {format(date, "MMM d")}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] font-medium text-ink truncate">
                              {e.title}
                            </div>
                            <div className="text-[10.5px] text-ink-3 mt-0.5 truncate">
                              {entrySubtitle(e)}
                            </div>
                          </div>
                          {b === "overdue" && (
                            <AlertCircle
                              size={13}
                              className="text-rose-deep flex-shrink-0"
                              aria-label="Overdue"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <footer className="border-t border-line px-4 py-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sage-deep" /> Done
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow" /> In progress
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-deep" /> Overdue
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cream-2 border border-line-2" /> Planned
          </span>
        </footer>
      </aside>
    </>
  );
}

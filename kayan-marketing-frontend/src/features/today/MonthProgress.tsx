import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCalendarEntries } from "../calendar/hooks/use-calendar-entries";
import type { CalendarEntry } from "../../types/calendar-entry";
import { CONTENT_FORMATS, type ContentFormat } from "../../constants/content-formats";

type ProgressBucket = "done" | "in_progress" | "overdue" | "planned";

const BUCKET_DOT: Record<ProgressBucket, string> = {
  done: "bg-sage-deep",
  in_progress: "bg-yellow",
  overdue: "bg-rose-deep",
  planned: "bg-cream-2 border border-line-2",
};

const BUCKET_LABEL: Record<ProgressBucket, string> = {
  done: "done",
  in_progress: "in progress",
  overdue: "overdue",
  planned: "planned",
};

function bucketFor(entry: CalendarEntry, today: string): ProgressBucket {
  if (entry.status === "done" || entry.status === "live") return "done";
  if (entry.status === "in_progress") return "in_progress";
  if (entry.status === "cancelled") return "planned";
  if (entry.targetDate < today) return "overdue";
  return "planned";
}

function groupOf(format: ContentFormat): "videos" | "stories" | "other" {
  if (format === CONTENT_FORMATS.VIDEO) return "videos";
  if (format === CONTENT_FORMATS.STORY) return "stories";
  return "other";
}

interface BucketCounts {
  done: number;
  in_progress: number;
  overdue: number;
  planned: number;
  total: number;
}

function emptyCounts(): BucketCounts {
  return { done: 0, in_progress: 0, overdue: 0, planned: 0, total: 0 };
}

function countEntries(entries: CalendarEntry[], today: string): BucketCounts {
  const out = emptyCounts();
  for (const e of entries) {
    if (e.status === "cancelled") continue;
    out[bucketFor(e, today)] += 1;
    out.total += 1;
  }
  return out;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface DotsProps {
  entries: CalendarEntry[];
  today: string;
  onDotClick?: (entryId: string) => void;
}

function Dots({ entries, today, onDotClick }: DotsProps): JSX.Element {
  const sorted = [...entries].sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  return (
    <div className="flex flex-wrap gap-[3px] flex-1 min-w-0">
      {sorted.map((e) => {
        const b = bucketFor(e, today);
        const dotEl = (
          <span
            className={`block w-2 h-2 rounded-full ${BUCKET_DOT[b]} flex-shrink-0`}
            title={`${e.title} — ${BUCKET_LABEL[b]} (${e.targetDate})`}
          />
        );
        if (onDotClick) {
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onDotClick(e.id)}
              aria-label={`${e.title} — ${BUCKET_LABEL[b]}`}
              className="hover:scale-150 transition-transform"
            >
              {dotEl}
            </button>
          );
        }
        return <span key={e.id}>{dotEl}</span>;
      })}
    </div>
  );
}

interface ProgressRowProps {
  label: string;
  counts: BucketCounts;
  entries: CalendarEntry[];
  today: string;
  onDotClick?: (entryId: string) => void;
}

function ProgressRow({
  label,
  counts,
  entries,
  today,
  onDotClick,
}: ProgressRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="eyebrow w-[60px] flex-shrink-0">{label}</span>
      {counts.total === 0 ? (
        <span className="text-[11.5px] text-ink-3 flex-1">none</span>
      ) : (
        <Dots entries={entries} today={today} onDotClick={onDotClick} />
      )}
      <span className="text-[11.5px] text-ink-3 flex-shrink-0 tabular-nums w-[44px] text-right">
        {counts.done}/{counts.total}
      </span>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }): JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}

interface Props {
  onOpenEntry?: (entryId: string) => void;
}

export function MonthProgress({ onOpenEntry }: Props): JSX.Element {
  const today = todayIso();
  const [cursor, setCursor] = useState<Date>(new Date());

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const fromIso = format(monthStart, "yyyy-MM-dd");
  const toIso = format(monthEnd, "yyyy-MM-dd");

  const entries = useCalendarEntries({ from: fromIso, to: toIso });
  const all = entries.data ?? [];

  const totals = countEntries(all, today);
  const videos = all.filter((e) => groupOf(e.format) === "videos");
  const stories = all.filter((e) => groupOf(e.format) === "stories");
  const others = all.filter((e) => groupOf(e.format) === "other");
  const videoCounts = countEntries(videos, today);
  const storyCounts = countEntries(stories, today);
  const otherCounts = countEntries(others, today);

  // Current week section (Sun-Sat). Anchored to real today, not cursor month.
  const realToday = new Date();
  const weekStart = startOfWeek(realToday, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(realToday, { weekStartsOn: 0 });
  const weekStartIso = format(weekStart, "yyyy-MM-dd");
  const weekEndIso = format(weekEnd, "yyyy-MM-dd");
  const weekEntries = all.filter(
    (e) => e.targetDate >= weekStartIso && e.targetDate <= weekEndIso,
  );
  const weekCounts = countEntries(weekEntries, today);

  const monthLabel = format(cursor, "MMMM yyyy");
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "d")}`;

  return (
    <section className="card mb-4 md:mb-5">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="h-card">Month progress</h2>
          <p className="text-[12px] text-ink-3 mt-0.5">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setCursor((c) => subMonths(c, 1))}
            aria-label="Previous month"
            className="iconbtn"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="btn btn-ghost text-[12px] !px-3 !py-1"
          >
            Now
          </button>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Next month"
            className="iconbtn"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      {entries.isLoading && <p className="text-ink-3 text-[13px]">Loading…</p>}

      {!entries.isLoading && totals.total === 0 && (
        <p className="text-ink-3 text-[13px] py-2">
          No content scheduled this month. Use the arrows to find a different month.
        </p>
      )}

      {totals.total > 0 && (
        <>
          {/* Headline: done / total */}
          <div className="flex flex-wrap items-baseline gap-3 mb-4">
            <span className="font-serif text-[28px] text-ink leading-none tracking-tight">
              {totals.done}
              <span className="text-ink-3 text-[18px]"> / {totals.total}</span>
            </span>
            <span className="text-[12px] text-ink-2">posts done</span>
            {totals.overdue > 0 && (
              <span className="chip status-overdue">{totals.overdue} overdue</span>
            )}
            {totals.in_progress > 0 && (
              <span className="chip" style={{ background: "#FFE9A8", color: "#6B4A0F" }}>
                {totals.in_progress} in progress
              </span>
            )}
          </div>

          {/* Per-type rows */}
          <div className="space-y-3">
            <ProgressRow
              label="Videos"
              counts={videoCounts}
              entries={videos}
              today={today}
              onDotClick={onOpenEntry}
            />
            <ProgressRow
              label="Stories"
              counts={storyCounts}
              entries={stories}
              today={today}
              onDotClick={onOpenEntry}
            />
            {otherCounts.total > 0 && (
              <ProgressRow
                label="Other"
                counts={otherCounts}
                entries={others}
                today={today}
                onDotClick={onOpenEntry}
              />
            )}
          </div>

          {/* This week (only if the cursor month contains today's week) */}
          {weekCounts.total > 0 && (
            <div className="mt-5 pt-4 border-t border-line">
              <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
                <span className="text-[12.5px] font-semibold text-ink">
                  This week ({weekLabel})
                </span>
                <span className="text-[11.5px] text-ink-3">
                  {weekCounts.done}/{weekCounts.total} done
                  {weekCounts.overdue > 0 && (
                    <span className="text-rose-deep ml-2">
                      · {weekCounts.overdue} overdue
                    </span>
                  )}
                </span>
              </div>
              <Dots entries={weekEntries} today={today} onDotClick={onOpenEntry} />
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-line text-[11px] text-ink-3">
            <Legend dot="bg-sage-deep" label="Done" />
            <Legend dot="bg-yellow" label="In progress" />
            <Legend dot="bg-rose-deep" label="Overdue" />
            <Legend dot="bg-cream-2 border border-line-2" label="Planned" />
          </div>
        </>
      )}
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addMonths,
  format,
  getDay,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCreateEntry } from "../calendar/hooks/use-calendar-entries";
import { useBrand } from "../brand/hooks/use-brand";
import { logger } from "../../utils/logger";
import type { Influencer } from "../../types/influencer";
import { buildQuickBookEntryInput } from "./utils/quick-book-defaults";

// Width is pinned so the portal-positioning math below can keep the
// popover inside the viewport on right-edge cards in the 4-col grid.
const POPOVER_WIDTH = 340;
const POPOVER_MARGIN = 16;
// Visual cap — pickable dates land in [today, today + MAX_FORWARD_DAYS].
// 90 days = current month + ~2 ahead.
const MAX_FORWARD_DAYS = 90;

interface QuickBookPopoverProps {
  influencer: Influencer;
  primaryName: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onBooked: (args: { entryId: string; message: string }) => void;
}

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function defaultTargetDate(): Date {
  // 7 days out — far enough to brief, close enough to feel actionable.
  return startOfDay(addDays(new Date(), 7));
}

function computeShootDate(targetDate: Date, schedulingBuffer: number): Date {
  return startOfDay(addDays(targetDate, -schedulingBuffer));
}

export function QuickBookPopover({
  influencer,
  primaryName,
  anchorEl,
  onClose,
  onBooked,
}: QuickBookPopoverProps): JSX.Element | null {
  const popoverRef = useRef<HTMLDivElement>(null);
  const createEntry = useCreateEntry();
  // Brand defaults govern shoot-date and editor offsets. Fallbacks
  // match the brands-table defaults (scheduling_buffer=3, editor_offset=2)
  // so we can render before the brand query resolves.
  const brand = useBrand(influencer.brandId);
  const schedulingBuffer = brand.data?.defaultSchedulingBuffer ?? 3;

  const today = useMemo(() => startOfDay(new Date()), []);

  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<Date>(defaultTargetDate());
  const [viewMonth, setViewMonth] = useState<Date>(
    startOfMonth(defaultTargetDate()),
  );
  const [title, setTitle] = useState<string>(`Collab with ${primaryName}`);
  const [budgetInput, setBudgetInput] = useState<string>(
    influencer.standardRate !== null ? String(influencer.standardRate) : "",
  );
  const [shootDateInput, setShootDateInput] = useState<string>(
    format(computeShootDate(defaultTargetDate(), schedulingBuffer), "yyyy-MM-dd"),
  );
  // Track whether the user has manually edited the shoot date so we
  // don't keep yanking it back when they pick a new target date.
  const [shootDateDirty, setShootDateDirty] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Position the popover under the anchor button, clamped to the viewport.
  useEffect(() => {
    if (!anchorEl) return;
    const compute = () => {
      const rect = anchorEl.getBoundingClientRect();
      const left = Math.min(
        Math.max(POPOVER_MARGIN, rect.right - POPOVER_WIDTH),
        window.innerWidth - POPOVER_WIDTH - POPOVER_MARGIN,
      );
      setPosition({ top: rect.bottom + 8, left });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [anchorEl]);

  // Click-outside + Escape close.
  useEffect(() => {
    const handleClick = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    };
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [anchorEl, onClose]);

  // Keep shoot date in sync when target moves — unless the user has
  // manually edited it (then their choice wins).
  useEffect(() => {
    if (shootDateDirty) return;
    setShootDateInput(
      format(computeShootDate(selectedDate, schedulingBuffer), "yyyy-MM-dd"),
    );
  }, [selectedDate, schedulingBuffer, shootDateDirty]);

  // Build a 42-cell month grid (6 weeks × 7 days) starting on Sunday.
  const monthDays = useMemo<Date[]>(() => {
    const start = startOfMonth(viewMonth);
    const startOffset = getDay(start);
    return Array.from({ length: 42 }, (_, i) =>
      addDays(start, i - startOffset),
    );
  }, [viewMonth]);

  const minMonth = useMemo(() => startOfMonth(today), [today]);
  const maxMonth = useMemo(
    () => startOfMonth(addDays(today, MAX_FORWARD_DAYS)),
    [today],
  );
  const canGoBack = !isSameMonth(viewMonth, minMonth);
  const canGoForward = !isSameMonth(viewMonth, maxMonth);

  const isTargetInPast = isBefore(selectedDate, today);
  const budgetNumber = Number(budgetInput);
  const budgetValid =
    budgetInput !== "" && !Number.isNaN(budgetNumber) && budgetNumber >= 0;
  const titleValid = title.trim().length >= 3;
  const canBook =
    !isTargetInPast && budgetValid && titleValid && !createEntry.isPending;

  const handleBook = async (): Promise<void> => {
    if (!canBook) return;
    setSubmitError(null);
    const targetDateIso = format(selectedDate, "yyyy-MM-dd");
    try {
      const payload = buildQuickBookEntryInput({
        influencer,
        primaryName,
        targetDate: selectedDate,
        brand: brand.data ?? null,
        titleOverride: title.trim(),
        budgetOverride: budgetNumber,
        // `null` here means "user cleared the shoot date input" — pass
        // it through so the entry stores null shoot_date. Otherwise
        // the util computes target − schedulingBuffer.
        shootDateOverride: shootDateInput || null,
      });
      const result = await createEntry.mutateAsync(payload);
      logger.info("quick-book entry created", {
        entryId: result.entry.id,
        influencerId: influencer.id,
        targetDate: targetDateIso,
      });
      onBooked({
        entryId: result.entry.id,
        message: `Booked ${primaryName} on ${format(selectedDate, "EEE MMM d")}`,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to book.";
      setSubmitError(message);
      logger.error("quick-book failed", { err: message });
    }
  };

  if (!position) return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Book a collab with ${primaryName}`}
      // The popover is portaled to <body>, but React events still bubble
      // through the component tree to the InfluencerCard's onClick. Stop
      // them here so interacting with the popover doesn't also open the
      // detail panel behind it.
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
      }}
      className="z-50 bg-paper rounded-[16px] shadow-lg border border-line p-4 text-ink"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="eyebrow text-[10px]">Quick book</p>
          <h3 className="font-serif text-[15px] font-semibold leading-tight truncate">
            {primaryName}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 grid place-items-center rounded-full hover:bg-cream-2 text-ink-3 hover:text-ink transition flex-shrink-0"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </header>

      <MiniCalendar
        viewMonth={viewMonth}
        onViewMonthChange={setViewMonth}
        monthDays={monthDays}
        selectedDate={selectedDate}
        onSelect={(d) => {
          setSelectedDate(d);
          if (!isSameMonth(d, viewMonth)) setViewMonth(startOfMonth(d));
        }}
        today={today}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
      />

      <div className="mt-3 space-y-2.5">
        <label className="block">
          <span className="eyebrow text-[10px]">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input mt-1 text-[13px]"
            maxLength={200}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="eyebrow text-[10px]">
              Budget {influencer.standardRate === null ? "(required)" : "SAR"}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="form-input mt-1 text-[13px] tabular-nums"
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="eyebrow text-[10px]">Shoot date</span>
            <input
              type="date"
              value={shootDateInput}
              onChange={(e) => {
                setShootDateInput(e.target.value);
                setShootDateDirty(true);
              }}
              max={format(selectedDate, "yyyy-MM-dd")}
              min={todayIso()}
              className="form-input mt-1 text-[13px] tabular-nums"
            />
          </label>
        </div>
      </div>

      {submitError && (
        <p className="mt-2 text-[11.5px] text-[#6E2A35] bg-rose/30 rounded px-2 py-1.5">
          {submitError}
        </p>
      )}

      <footer className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-[12.5px] text-ink-3 hover:text-ink px-3 py-2 rounded-full"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleBook}
          disabled={!canBook}
          className="bg-obsidian text-yellow text-[13px] font-semibold rounded-full px-5 py-2 hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {createEntry.isPending ? "Booking…" : "Book →"}
        </button>
      </footer>
    </div>,
    document.body,
  );
}

// ── Sub-component: mini calendar grid ────────────────────────────────

interface MiniCalendarProps {
  viewMonth: Date;
  onViewMonthChange: (d: Date) => void;
  monthDays: Date[];
  selectedDate: Date;
  onSelect: (d: Date) => void;
  today: Date;
  canGoBack: boolean;
  canGoForward: boolean;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function MiniCalendar({
  viewMonth,
  onViewMonthChange,
  monthDays,
  selectedDate,
  onSelect,
  today,
  canGoBack,
  canGoForward,
}: MiniCalendarProps): JSX.Element {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <button
          type="button"
          onClick={() => onViewMonthChange(subMonths(viewMonth, 1))}
          disabled={!canGoBack}
          className="w-7 h-7 grid place-items-center rounded-full hover:bg-cream-2 text-ink-2 disabled:opacity-30 disabled:cursor-not-allowed transition"
          aria-label="Previous month"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[12.5px] font-semibold tabular-nums">
          {format(viewMonth, "MMMM yyyy")}
        </span>
        <button
          type="button"
          onClick={() => onViewMonthChange(addMonths(viewMonth, 1))}
          disabled={!canGoForward}
          className="w-7 h-7 grid place-items-center rounded-full hover:bg-cream-2 text-ink-2 disabled:opacity-30 disabled:cursor-not-allowed transition"
          aria-label="Next month"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, idx) => (
          <span
            key={idx}
            className="text-center text-[10px] text-ink-3 font-semibold py-1"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {monthDays.map((d) => {
          const inMonth = isSameMonth(d, viewMonth);
          const isSelected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          const isPast = isBefore(d, today);
          return (
            <button
              key={d.toISOString()}
              type="button"
              disabled={isPast}
              onClick={() => onSelect(d)}
              className={`h-8 text-[12px] rounded-md transition tabular-nums ${
                isSelected
                  ? "bg-obsidian text-yellow font-bold"
                  : isPast
                    ? "text-ink-3 opacity-30 cursor-not-allowed"
                    : inMonth
                      ? "text-ink hover:bg-cream-2"
                      : "text-ink-3 hover:bg-cream-2"
              } ${isToday && !isSelected ? "ring-1 ring-yellow" : ""}`}
              aria-label={format(d, "EEEE MMMM d, yyyy")}
              aria-pressed={isSelected}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

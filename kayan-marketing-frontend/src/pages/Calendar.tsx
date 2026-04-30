import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { addMonths, subMonths, addWeeks, subWeeks, format, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCurrentBrand } from "../hooks/use-current-brand";
import { MonthlyView } from "../features/calendar/MonthlyView";
import { WeeklyView } from "../features/calendar/WeeklyView";
import { AddEntryModal } from "../features/calendar/AddEntryModal";
import { EntryDetailPanel } from "../features/calendar/EntryDetailPanel";
import { BranchSelector } from "../features/branches/BranchSelector";

type ViewMode = "monthly" | "weekly";

const BRANCH_PARAM = "branchId";

export default function CalendarPage(): JSX.Element {
  const { brandId } = useCurrentBrand();
  const [view, setView] = useState<ViewMode>("monthly");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [addEntryDate, setAddEntryDate] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const branchFilter = searchParams.get(BRANCH_PARAM);

  const setBranchFilter = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next) params.set(BRANCH_PARAM, next);
          else params.delete(BRANCH_PARAM);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const goPrev = (): void =>
    setCursor((c) => (view === "monthly" ? subMonths(c, 1) : subWeeks(c, 1)));
  const goNext = (): void =>
    setCursor((c) => (view === "monthly" ? addMonths(c, 1) : addWeeks(c, 1)));
  const goToday = (): void => setCursor(new Date());

  const handleDayClick = (day: Date): void => {
    setCursor(day);
    setView("weekly");
  };

  const handleAddOnDay = (day: Date): void => {
    setAddEntryDate(format(day, "yyyy-MM-dd"));
  };

  const headerLabel =
    view === "monthly"
      ? format(cursor, "MMMM yyyy")
      : `${format(startOfWeek(cursor, { weekStartsOn: 0 }), "MMM d")} – ${format(
          endOfWeek(cursor, { weekStartsOn: 0 }),
          "MMM d, yyyy",
        )}`;

  return (
    <div className="px-9 pt-8 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="h-greeting">
            Editorial <em>calendar</em>
          </h1>
          <p className="text-[14px] text-ink-2 mt-1.5">{headerLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1">
            <button onClick={goPrev} aria-label="Previous" className="iconbtn">
              <ChevronLeft size={16} />
            </button>
            <button onClick={goToday} className="btn btn-ghost">
              Today
            </button>
            <button onClick={goNext} aria-label="Next" className="iconbtn">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="min-w-[200px]">
            <BranchSelector
              brandId={brandId}
              value={branchFilter ?? ""}
              onChange={setBranchFilter}
              includeAllOption
              allOptionLabel="All branches"
              ariaLabel="Filter by branch"
            />
          </div>

          <div className="tab-group">
            <button
              onClick={() => setView("monthly")}
              className={`tab ${view === "monthly" ? "tab-active" : ""}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setView("weekly")}
              className={`tab ${view === "weekly" ? "tab-active" : ""}`}
            >
              Weekly
            </button>
          </div>

          <button
            onClick={() => setAddEntryDate(format(cursor, "yyyy-MM-dd"))}
            className="btn btn-primary"
          >
            <Plus size={14} />
            Add Entry
          </button>
        </div>
      </header>

      {view === "monthly" ? (
        <MonthlyView
          cursor={cursor}
          branchId={branchFilter}
          onOpenEntry={setOpenEntryId}
          onDayClick={handleDayClick}
          onAddOnDay={handleAddOnDay}
        />
      ) : (
        <WeeklyView
          cursor={cursor}
          branchId={branchFilter}
          onOpenEntry={setOpenEntryId}
          onAddOnDay={handleAddOnDay}
        />
      )}

      <AddEntryModal
        brandId={brandId}
        isOpen={addEntryDate !== null}
        onClose={() => setAddEntryDate(null)}
        defaultDate={addEntryDate ?? undefined}
      />
      <EntryDetailPanel entryId={openEntryId} onClose={() => setOpenEntryId(null)} />
    </div>
  );
}

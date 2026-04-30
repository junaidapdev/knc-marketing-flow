import { useState } from "react";
import { format } from "date-fns";
import { Plus, RefreshCw, Search, Bell } from "lucide-react";
import { useCurrentBrand } from "../hooks/use-current-brand";
import { useTodaySummary } from "../features/today/hooks/use-today-summary";
import { useToggleTaskStatus } from "../features/today/hooks/use-toggle-task-status";
import { OverdueAlertStrip } from "../features/today/OverdueAlertStrip";
import { DayTypeBanner } from "../features/today/DayTypeBanner";
import { DailyDocket } from "../features/today/DailyDocket";
import { ThreeDayRadar } from "../features/today/ThreeDayRadar";
import { BudgetSnapshot } from "../features/today/BudgetSnapshot";
import { MonthProgress } from "../features/today/MonthProgress";
import { AddEntryModal } from "../features/calendar/AddEntryModal";
import { QuickAddTaskModal } from "../features/tasks/QuickAddTaskModal";
import { EntryDetailPanel } from "../features/calendar/EntryDetailPanel";
import type { Task, TaskStatus } from "../types/task";
import { logger } from "../utils/logger";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TodayPage(): JSX.Element {
  const { brandId } = useCurrentBrand();
  const today = todayIso();

  const summary = useTodaySummary(brandId, today);
  const toggle = useToggleTaskStatus(brandId, today);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const [isAddEntryOpen, setAddEntryOpen] = useState(false);
  const [isQuickAddOpen, setQuickAddOpen] = useState(false);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  const handleToggleStatus = async (taskId: string, nextStatus: TaskStatus): Promise<void> => {
    setPendingTaskId(taskId);
    try {
      await toggle.mutateAsync({ taskId, nextStatus });
    } catch (err) {
      logger.error("status toggle failed in today page", { err: String(err) });
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleOpenTaskMenu = (task: Task): void => {
    if (task.entryId) {
      setOpenEntryId(task.entryId);
    }
  };

  const friendlyDate = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6 mb-5 md:mb-7">
        <div>
          <h1 className="h-greeting text-[24px] md:text-[30px]">
            Today's <em>plan</em>
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">{friendlyDate}</p>
        </div>
        <div className="flex items-center gap-2 md:gap-2.5 flex-wrap">
          <div className="search-bar hidden xl:flex">
            <Search size={15} />
            <input placeholder="Search campaigns, entries, tasks…" />
            <span className="kbd">⌘K</span>
          </div>
          <button
            onClick={() => summary.refetch()}
            disabled={summary.isFetching}
            aria-label="Refresh"
            title="Refresh"
            className="iconbtn"
          >
            <RefreshCw size={16} className={summary.isFetching ? "animate-spin" : ""} />
          </button>
          <button className="iconbtn relative" title="Notifications">
            <Bell size={16} />
            <span className="absolute top-2 right-2 w-[7px] h-[7px] rounded-full bg-peach-deep border-2 border-cream-2" />
          </button>
          <button onClick={() => setQuickAddOpen(true)} className="btn btn-ghost">
            <Plus size={14} />
            <span className="hidden sm:inline">New Task</span>
            <span className="sm:hidden">Task</span>
          </button>
          <button onClick={() => setAddEntryOpen(true)} className="btn btn-primary">
            <Plus size={14} />
            <span className="hidden sm:inline">Add Entry</span>
            <span className="sm:hidden">Entry</span>
          </button>
        </div>
      </header>

      {summary.isError && (
        <div className="rounded-md border border-rose-deep/40 bg-rose/40 text-[#6E2A35] p-4 mb-4 text-[13px]">
          {summary.error instanceof Error
            ? summary.error.message
            : "Failed to load today's summary."}
        </div>
      )}

      {summary.isLoading && !summary.data && (
        <div className="text-ink-3 text-[14px] py-8">Loading today's docket…</div>
      )}

      {summary.data && (
        <>
          <DayTypeBanner tasks={summary.data.today.tasks} />

          <MonthProgress onOpenEntry={setOpenEntryId} />

          <OverdueAlertStrip count={summary.data.overdue.count} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
            <div className="lg:col-span-2 space-y-4 md:space-y-5">
              <section className="card">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="h-card">Today's tasks</h2>
                  <span className="eyebrow">{summary.data.today.tasks.length} tasks</span>
                </div>
                <DailyDocket
                  tasks={summary.data.today.tasks}
                  onToggleStatus={handleToggleStatus}
                  onOpenTaskMenu={handleOpenTaskMenu}
                  pendingTaskId={pendingTaskId}
                />
              </section>

              {summary.data.overdue.count > 0 && (
                <section className="card">
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="h-card">Overdue</h2>
                    <span className="chip status-overdue">
                      {summary.data.overdue.count} late
                    </span>
                  </div>
                  <DailyDocket
                    tasks={summary.data.overdue.tasks}
                    onToggleStatus={handleToggleStatus}
                    onOpenTaskMenu={handleOpenTaskMenu}
                    pendingTaskId={pendingTaskId}
                  />
                </section>
              )}
            </div>

            <aside className="space-y-4 lg:space-y-4">
              <ThreeDayRadar radar={summary.data.radar} />
              <BudgetSnapshot budget={summary.data.budget} />
            </aside>
          </div>
        </>
      )}

      <AddEntryModal
        brandId={brandId}
        isOpen={isAddEntryOpen}
        onClose={() => setAddEntryOpen(false)}
      />
      <QuickAddTaskModal
        isOpen={isQuickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        defaultDueDate={today}
      />
      <EntryDetailPanel entryId={openEntryId} onClose={() => setOpenEntryId(null)} />
    </div>
  );
}

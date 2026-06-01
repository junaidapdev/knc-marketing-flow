import { useMemo, useState } from "react";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { useCurrentBrand } from "../hooks/use-current-brand";
import {
  MONTHLY_VIDEO_PLAN_COPY,
  MONTHLY_VIDEO_PLAN_MONTH_FORMAT,
  MONTHLY_VIDEO_PLAN_MONTH_LABEL_FORMAT,
} from "../constants/monthly-video-plan";
import {
  useCopyFromPreviousMonth,
  useCreatePlanItem,
  useDeletePlanItem,
  useMonthlyVideoPlan,
  useUpdatePlanItem,
} from "../features/monthly-video-plan/hooks/use-monthly-video-plan";
import { AddItemRow } from "../features/monthly-video-plan/AddItemRow";
import { ItemRow } from "../features/monthly-video-plan/ItemRow";
import { formatMonthTotal } from "../features/monthly-video-plan/utils/format-count";
import { logger } from "../utils/logger";

export default function GoalsPage(): JSX.Element {
  const { brandId } = useCurrentBrand();
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));

  const month = format(cursor, MONTHLY_VIDEO_PLAN_MONTH_FORMAT);
  const previousMonth = format(
    subMonths(cursor, 1),
    MONTHLY_VIDEO_PLAN_MONTH_FORMAT,
  );

  const planQuery = useMonthlyVideoPlan(brandId, month);
  const createItem = useCreatePlanItem();
  const updateItem = useUpdatePlanItem();
  const deleteItem = useDeletePlanItem();
  const copyFromPrevious = useCopyFromPreviousMonth();

  const items = useMemo(() => planQuery.data ?? [], [planQuery.data]);
  const total = useMemo(() => formatMonthTotal(items), [items]);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const handleCopyFromPrevious = async (): Promise<void> => {
    setCopyFeedback(null);
    try {
      const copied = await copyFromPrevious.mutateAsync({
        brandId,
        targetMonth: month,
        sourceMonth: previousMonth,
      });
      setCopyFeedback(
        copied.length === 0
          ? MONTHLY_VIDEO_PLAN_COPY.copyEmptyMessage
          : MONTHLY_VIDEO_PLAN_COPY.copySuccessMessage,
      );
    } catch (err) {
      logger.error("copy from previous failed", { err: String(err) });
      setCopyFeedback(
        err instanceof Error
          ? err.message
          : MONTHLY_VIDEO_PLAN_COPY.errorFallbackMessage,
      );
    }
  };

  const handleAdd = async (input: {
    label: string;
    count: number;
    countMax: number | null;
  }): Promise<void> => {
    await createItem.mutateAsync({
      brandId,
      month,
      label: input.label,
      count: input.count,
      countMax: input.countMax,
    });
  };

  const handleSave = async (patch: {
    id: string;
    label: string;
    count: number;
    countMax: number | null;
  }): Promise<void> => {
    await updateItem.mutateAsync({
      ...patch,
      brandId,
      month,
    });
  };

  const handleDelete = async (id: string): Promise<void> => {
    await deleteItem.mutateAsync({ id, brandId, month });
  };

  const showCopyButton =
    !planQuery.isLoading &&
    !planQuery.isError &&
    items.length === 0 &&
    !copyFromPrevious.isPending;

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h-greeting text-[24px] md:text-[30px]">
            {MONTHLY_VIDEO_PLAN_COPY.pageTitle}{" "}
            <em>{MONTHLY_VIDEO_PLAN_COPY.pageSubtitle}</em>
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
            {format(cursor, MONTHLY_VIDEO_PLAN_MONTH_LABEL_FORMAT)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor((c) => subMonths(c, 1))}
            aria-label="Previous month"
            className="iconbtn"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="btn btn-ghost"
          >
            <span className="hidden sm:inline">This month</span>
            <span className="sm:hidden">Now</span>
          </button>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Next month"
            className="iconbtn"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {/* Total card */}
      <section className="card card-cream">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-ink-2">
            {MONTHLY_VIDEO_PLAN_COPY.totalSingleLabel}
          </span>
          <span className="font-serif text-[28px] text-ink tabular-nums">
            {total}
          </span>
        </div>
      </section>

      {/* Error state */}
      {planQuery.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 text-[13px]">
          <div className="font-semibold mb-1">
            {MONTHLY_VIDEO_PLAN_COPY.errorLoadingHeading}
          </div>
          <div>
            {planQuery.error instanceof Error
              ? planQuery.error.message
              : MONTHLY_VIDEO_PLAN_COPY.errorFallbackMessage}
          </div>
          <button
            onClick={() => planQuery.refetch()}
            className="btn btn-ghost mt-2 text-[12px] px-3 py-1.5"
          >
            {MONTHLY_VIDEO_PLAN_COPY.retryButton}
          </button>
        </div>
      )}

      {/* Loading */}
      {planQuery.isLoading && (
        <p className="text-ink-3 text-[13px]">Loading…</p>
      )}

      {/* Empty + copy-from-previous */}
      {!planQuery.isLoading &&
        !planQuery.isError &&
        items.length === 0 && (
          <section className="card text-center py-8 space-y-3">
            <h2 className="text-[15px] font-semibold text-ink">
              {MONTHLY_VIDEO_PLAN_COPY.emptyHeading}
            </h2>
            <p className="text-[13px] text-ink-3 max-w-md mx-auto">
              {MONTHLY_VIDEO_PLAN_COPY.emptyHint}
            </p>
            {showCopyButton && (
              <div className="pt-1">
                <button
                  onClick={handleCopyFromPrevious}
                  disabled={copyFromPrevious.isPending}
                  className="btn btn-ghost"
                >
                  <Copy size={13} />
                  <span>
                    {MONTHLY_VIDEO_PLAN_COPY.copyFromPreviousButton}
                  </span>
                </button>
                <p className="text-[11.5px] text-ink-3 mt-1.5">
                  {MONTHLY_VIDEO_PLAN_COPY.copyFromPreviousHint}
                </p>
              </div>
            )}
          </section>
        )}

      {copyFeedback && (
        <div className="text-[12.5px] text-ink-2 px-1">{copyFeedback}</div>
      )}

      {/* Items list */}
      {items.length > 0 && (
        <section className="space-y-2.5">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ))}
        </section>
      )}

      {/* Inline add row — always visible once the page has loaded */}
      {!planQuery.isLoading && !planQuery.isError && (
        <AddItemRow onAdd={handleAdd} disabled={createItem.isPending} />
      )}
    </div>
  );
}

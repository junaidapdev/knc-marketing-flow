import { useMemo, useState } from "react";
import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useCurrentBrand } from "../hooks/use-current-brand";
import { useBudgetSummary, useBudgetCap } from "../features/budget/hooks/use-budget";
import { EditBudgetModal } from "../features/budget/EditBudgetModal";
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABELS,
  type BudgetCategory,
} from "../constants/budget-categories";
import type { BudgetContributingRow } from "../types/budget";

const CATEGORY_VALUES = Object.values(BUDGET_CATEGORIES) as BudgetCategory[];

function clampPercent(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

function formatSar(v: number): string {
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR`;
}

function barColorFor(pct: number): string {
  if (pct >= 90) return "bg-rose-deep";
  if (pct >= 70) return "bg-yellow";
  return "bg-sage-deep";
}

export default function BudgetPage(): JSX.Element {
  const { brandId } = useCurrentBrand();
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const monthIso = format(cursor, "yyyy-MM-01");
  const [editing, setEditing] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<BudgetCategory | null>(null);

  const summary = useBudgetSummary(brandId, monthIso);
  const cap = useBudgetCap(brandId, monthIso);

  const contributingByCategory = useMemo(() => {
    const map = new Map<BudgetCategory, BudgetContributingRow[]>();
    if (!summary.data) return map;
    for (const row of summary.data.contributingEntries) {
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    return map;
  }, [summary.data]);

  return (
    <div className="px-9 pt-8 pb-12 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h-greeting">
            Budget <em>tracker</em>
          </h1>
          <p className="text-[14px] text-ink-2 mt-1.5">{format(cursor, "MMMM yyyy")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
              This month
            </button>
            <button
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label="Next month"
              className="iconbtn"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button onClick={() => setEditing(true)} className="btn btn-primary">
            <Pencil size={13} />
            Edit Budget
          </button>
        </div>
      </header>

      {summary.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 text-[13px]">
          {summary.error instanceof Error ? summary.error.message : "Failed to load budget."}
        </div>
      )}
      {summary.isLoading && <p className="text-ink-3 text-[13px]">Loading…</p>}

      {summary.data && (
        <>
          <TotalCapCard total={summary.data.cap.total} spent={summary.data.spent.total} />

          <section>
            <h2 className="h-card mb-3">Categories</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {CATEGORY_VALUES.map((cat) => {
                const catCap = summary.data!.cap.byCategory[cat] ?? 0;
                const catSpent = summary.data!.spent.byCategory[cat] ?? 0;
                const remaining = Math.max(0, catCap - catSpent);
                const pct = catCap > 0 ? clampPercent((catSpent / catCap) * 100) : 0;
                const isOpen = expandedCategory === cat;
                const rows = contributingByCategory.get(cat) ?? [];
                return (
                  <div key={cat} className="card p-0 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedCategory(isOpen ? null : cat)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-[13.5px] font-semibold text-ink">
                          {BUDGET_CATEGORY_LABELS[cat]}
                        </span>
                        <span className="text-[11.5px] text-ink-3">
                          {formatSar(catSpent)} / {formatSar(catCap)}
                        </span>
                      </div>
                      <div className="progress">
                        <div
                          className={`progress-fill ${barColorFor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11.5px] text-ink-3 mt-1.5">
                        <span>{pct.toFixed(0)}% used</span>
                        <span>{formatSar(remaining)} left</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-line p-4 space-y-2 bg-cream-2/20">
                        {rows.length === 0 ? (
                          <p className="text-[12px] text-ink-3">No spend logged.</p>
                        ) : (
                          rows.map((row) => (
                            <div
                              key={`${row.type}-${row.id}`}
                              className="flex justify-between gap-2 text-[12px]"
                            >
                              <span className="truncate text-ink">
                                <span className="text-ink-3 mr-1">
                                  {row.type === "campaign_ad_spend" ? "Ad" : "Entry"}
                                </span>
                                {row.title}
                              </span>
                              <span className="text-ink-2 shrink-0">
                                {formatSar(row.amount)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <EditBudgetModal
        brandId={brandId}
        month={monthIso}
        isOpen={editing}
        onClose={() => setEditing(false)}
        existing={cap.data ?? null}
      />
    </div>
  );
}

function TotalCapCard({ total, spent }: { total: number; spent: number }): JSX.Element {
  const remaining = Math.max(0, total - spent);
  const pct = total > 0 ? clampPercent((spent / total) * 100) : 0;
  return (
    <section className="card card-cream">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[13px] text-ink-2">Total spent this month</span>
        <span className="text-[14px]">
          <span className="font-serif text-[20px] text-ink">{formatSar(spent)}</span>
          <span className="text-ink-3 ml-1.5"> / {formatSar(total)}</span>
        </span>
      </div>
      <div className="progress">
        <div className={`progress-fill ${barColorFor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[12px] text-ink-3 mt-2">
        <span>{pct.toFixed(0)}% used</span>
        <span>{formatSar(remaining)} remaining</span>
      </div>
    </section>
  );
}

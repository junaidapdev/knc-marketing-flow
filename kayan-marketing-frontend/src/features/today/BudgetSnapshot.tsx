import type { BudgetSection } from "../../types/today-summary";
import { BUDGET_CATEGORY_LABELS } from "../../constants/budget-categories";

interface Props {
  budget: BudgetSection;
}

function formatSar(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR`;
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function barFill(pct: number): string {
  if (pct >= 90) return "bg-rose-deep";
  if (pct >= 70) return "bg-yellow";
  return "bg-sage-deep";
}

export function BudgetSnapshot({ budget }: Props): JSX.Element {
  const totalPercent = clampPercent(budget.percentUsed);

  return (
    <section className="card card-cream">
      <h3 className="h-card-sm mb-4">Budget · This Month</h3>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12.5px] text-ink-2">Total spent</span>
        <span className="text-[13px]">
          <span className="font-semibold text-ink">{formatSar(budget.monthSpent)}</span>
          <span className="text-ink-3"> / {formatSar(budget.monthCap)}</span>
        </span>
      </div>
      <div className="progress">
        <div className={`progress-fill ${barFill(totalPercent)}`} style={{ width: `${totalPercent}%` }} />
      </div>
      <div className="text-[11.5px] text-ink-3 mt-1.5">{totalPercent.toFixed(0)}% used</div>

      <div className="mt-5">
        <div className="eyebrow mb-2">Top categories</div>
        {budget.topCategories.length === 0 ? (
          <p className="text-[12.5px] text-ink-3">No spend logged this month.</p>
        ) : (
          <ul className="space-y-3">
            {budget.topCategories.map((row) => {
              const pct = row.cap > 0 ? clampPercent((row.spent / row.cap) * 100) : 0;
              return (
                <li key={row.category}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-ink">
                      {BUDGET_CATEGORY_LABELS[row.category] ?? row.category}
                    </span>
                    <span className="text-ink-3">
                      {formatSar(row.spent)} / {formatSar(row.cap)}
                    </span>
                  </div>
                  <div className="progress">
                    <div className={`progress-fill ${barFill(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

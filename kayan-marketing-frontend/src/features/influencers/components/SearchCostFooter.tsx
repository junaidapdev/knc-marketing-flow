import type { CreatorSearchCostBreakdown } from "../../../types/influencer";

// Small line under the results grid: "This search cost $0.12 (Apify $0.08,
// Claude $0.04)". Pulled from the run's creator_search_costs row, returned
// inline in /search-creators's response.

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

interface Props {
  cost: CreatorSearchCostBreakdown;
}

export function SearchCostFooter({ cost }: Props): JSX.Element {
  return (
    <div className="text-[11.5px] text-ink-3 italic px-1 py-1">
      This search cost{" "}
      <span className="text-ink-2 not-italic font-semibold tabular-nums">
        {formatUsd(cost.totalCostUsd)}
      </span>
      {" — "}Apify{" "}
      <span className="not-italic tabular-nums">{formatUsd(cost.apifyCostUsd)}</span>
      {", "}Claude{" "}
      <span className="not-italic tabular-nums">{formatUsd(cost.claudeCostUsd)}</span>
      .
    </div>
  );
}

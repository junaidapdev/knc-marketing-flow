import type { CreatorResult } from "../../../types/influencer";
import { ResultCard, type CardAction } from "./ResultCard";
import { CardSkeletonGrid } from "./CardSkeleton";
import { EstimatedBadge } from "./EstimatedBadge";

interface Props {
  results: ReadonlyArray<CreatorResult>;
  isLoading: boolean;
  hasSearched: boolean;
  errorMessage: string | null;
  // Lets each page (Search vs Saved) compose the per-card action without
  // duplicating the grid layout or empty/loading/error states.
  renderAction: (creator: CreatorResult) => CardAction;
  // Optional override for the empty + pre-search messages so the Saved
  // view can show its own copy. The disclaimer strip is rendered for both
  // pages — toggle off only if a parent has its own.
  emptyMessage?: string;
  preSearchMessage?: string;
  showDisclaimer?: boolean;
}

const DEFAULT_DISCLAIMER =
  "Audience demographics on these cards are estimates from third-party scrapers, not the platform's official analytics.";

export function ResultsGrid({
  results,
  isLoading,
  hasSearched,
  errorMessage,
  renderAction,
  emptyMessage = "No creators matched these filters. Try widening platforms, follower range, or content categories.",
  preSearchMessage = "Set your filters and run a search to see creators here.",
  showDisclaimer = true,
}: Props): JSX.Element {
  if (errorMessage) {
    return (
      <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-3 py-2.5 text-[12.5px]">
        {errorMessage}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {showDisclaimer && <DisclaimerStrip />}
        <CardSkeletonGrid />
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="text-[13px] text-ink-3 italic px-1 py-3">
        {preSearchMessage}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-[13px] text-ink-3 italic px-1 py-3">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showDisclaimer && <DisclaimerStrip />}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {results.map((creator) => (
          <ResultCard
            key={creator.id}
            creator={creator}
            action={renderAction(creator)}
          />
        ))}
      </div>
    </div>
  );
}

function DisclaimerStrip(): JSX.Element {
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-ink-3 px-1">
      <EstimatedBadge title={DEFAULT_DISCLAIMER} />
      <span className="leading-snug">{DEFAULT_DISCLAIMER}</span>
    </div>
  );
}

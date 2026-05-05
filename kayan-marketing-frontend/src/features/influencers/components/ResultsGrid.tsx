import { Loader2 } from "lucide-react";
import type { CreatorResult } from "../../../types/influencer";
import { ResultCard } from "./ResultCard";

interface Props {
  results: ReadonlyArray<CreatorResult>;
  isLoading: boolean;
  hasSearched: boolean;
  errorMessage: string | null;
}

export function ResultsGrid({
  results,
  isLoading,
  hasSearched,
  errorMessage,
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
      <div className="flex items-center gap-2 text-[13px] text-ink-3 px-1 py-3">
        <Loader2 size={14} className="animate-spin" />
        Searching creators…
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="text-[13px] text-ink-3 italic px-1 py-3">
        Set your filters and run a search to see creators here.
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-[13px] text-ink-3 italic px-1 py-3">
        No creators matched these filters. Try widening platforms, follower
        range, or content categories.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {results.map((creator) => (
        <ResultCard key={creator.id} creator={creator} />
      ))}
    </div>
  );
}

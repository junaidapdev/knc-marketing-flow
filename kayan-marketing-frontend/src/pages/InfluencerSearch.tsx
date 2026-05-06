import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { FilterForm } from "../features/influencers/components/FilterForm";
import { ResultsGrid } from "../features/influencers/components/ResultsGrid";
import { EstimateCostModal } from "../features/influencers/components/EstimateCostModal";
import { SearchCostFooter } from "../features/influencers/components/SearchCostFooter";
import { useCreatorSearch } from "../features/influencers/hooks/use-creator-search";
import { useEstimateCost } from "../features/influencers/hooks/use-estimate-cost";
import type {
  CreatorResult,
  CreatorSearchCostBreakdown,
  CreatorSearchFilters,
} from "../types/influencer";
import { logger } from "../utils/logger";

// Page flow:
//  1. User fills the form and clicks either "Estimate cost" or "Search".
//  2. Estimate → we call /estimate-creator-search (pure math, no paid
//     calls) and open the modal. From the modal, "Proceed" triggers a
//     real /search-creators run for the same filter set.
//  3. Search → we hit /search-creators directly. Results, partial
//     failures, and the actual run cost all come back in the same
//     response.
export default function InfluencerSearchPage(): JSX.Element {
  const search = useCreatorSearch();
  const estimate = useEstimateCost();

  const [results, setResults] = useState<CreatorResult[]>([]);
  const [failureReasons, setFailureReasons] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [cost, setCost] = useState<CreatorSearchCostBreakdown | null>(null);

  const [estimateOpen, setEstimateOpen] = useState(false);
  // Filters captured the moment the user clicked Estimate, replayed when
  // Proceed fires — so the search runs against exactly what was estimated
  // even if they fiddle with the form between the two clicks.
  const [pendingFilters, setPendingFilters] =
    useState<CreatorSearchFilters | null>(null);

  const runSearch = async (filters: CreatorSearchFilters): Promise<void> => {
    setHasSearched(true);
    setFailureReasons([]);
    setCost(null);
    try {
      const data = await search.mutateAsync(filters);
      setResults(data.results);
      setFailureReasons(data.failureReasons);
      setCost(data.cost);
    } catch (err) {
      logger.error("creator search failed", { err: String(err) });
    }
  };

  const onEstimate = async (filters: CreatorSearchFilters): Promise<void> => {
    setPendingFilters(filters);
    setEstimateOpen(true);
    try {
      await estimate.mutateAsync(filters);
    } catch (err) {
      logger.error("creator search estimate failed", { err: String(err) });
    }
  };

  const onProceed = async (): Promise<void> => {
    setEstimateOpen(false);
    if (pendingFilters) await runSearch(pendingFilters);
  };

  const errorMessage = search.isError
    ? search.error instanceof Error
      ? search.error.message
      : "Search failed."
    : null;

  const estimateError = estimate.isError
    ? estimate.error instanceof Error
      ? estimate.error.message
      : "Estimate failed."
    : null;

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12 space-y-6">
      <header>
        <h1 className="h-greeting text-[24px] md:text-[30px]">
          Influencer <em>Search</em>
        </h1>
        <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
          Discover GCC creators across TikTok, Instagram, and YouTube. AI-
          scored for fit with Kayan; cost is previewable before each run.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <aside className="card">
          <FilterForm
            isSubmitting={search.isPending}
            isEstimating={estimate.isPending}
            onSubmit={runSearch}
            onEstimate={onEstimate}
          />
        </aside>

        <section className="space-y-3">
          {failureReasons.length > 0 && (
            <FailureStrip reasons={failureReasons} />
          )}
          <ResultsGrid
            results={results}
            isLoading={search.isPending}
            hasSearched={hasSearched}
            errorMessage={errorMessage}
          />
          {cost && !search.isPending && results.length > 0 && (
            <SearchCostFooter cost={cost} />
          )}
        </section>
      </div>

      <EstimateCostModal
        isOpen={estimateOpen}
        isLoading={estimate.isPending}
        estimate={estimate.data ?? null}
        errorMessage={estimateError}
        onClose={() => setEstimateOpen(false)}
        onProceed={onProceed}
      />
    </div>
  );
}

// Inline partial-failure strip. Each reason is a string of the form
// "<platform>: <message>" — we render the platform name as a chip and
// abbreviate the message so a long actor stack trace doesn't overflow.
function FailureStrip({ reasons }: { reasons: string[] }): JSX.Element {
  return (
    <div className="rounded-md bg-yellow-bg border border-yellow/60 px-3 py-2 text-[12.5px] text-ink-2 flex items-start gap-2">
      <AlertTriangle size={14} className="text-yellow-bg-deep flex-shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <div className="font-semibold text-ink">
          Some platforms didn't return results.
        </div>
        {reasons.map((r, i) => {
          const [platform, ...rest] = r.split(":");
          const message = rest.join(":").trim();
          return (
            <div key={i} className="text-ink-3">
              <span className="font-mono text-ink">{platform}</span>
              {message ? ` — ${message.slice(0, 140)}` : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

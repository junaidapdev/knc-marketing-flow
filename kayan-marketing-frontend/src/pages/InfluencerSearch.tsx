import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { FilterForm } from "../features/influencers/components/FilterForm";
import { ResultsGrid } from "../features/influencers/components/ResultsGrid";
import { useCreatorSearch } from "../features/influencers/hooks/use-creator-search";
import type { CreatorResult, CreatorSearchFilters } from "../types/influencer";
import { logger } from "../utils/logger";

// Chunk 3+4 wiring: real /search-creators backend with parallel fan-out
// across all three platforms. Partial-failure UX: if one platform's actor
// errors but the others succeed, results render normally with a warning
// strip listing the failed platform(s) above the grid.
export default function InfluencerSearchPage(): JSX.Element {
  const search = useCreatorSearch();
  // Holds the most recent successful result set so the grid can keep
  // showing them across re-renders that aren't part of a new search.
  const [results, setResults] = useState<CreatorResult[]>([]);
  const [failureReasons, setFailureReasons] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const onSubmit = async (filters: CreatorSearchFilters): Promise<void> => {
    setHasSearched(true);
    setFailureReasons([]);
    try {
      const data = await search.mutateAsync(filters);
      setResults(data.results);
      setFailureReasons(data.failureReasons);
    } catch (err) {
      logger.error("creator search failed", { err: String(err) });
    }
  };

  const errorMessage = search.isError
    ? search.error instanceof Error
      ? search.error.message
      : "Search failed."
    : null;

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12 space-y-6">
      <header>
        <h1 className="h-greeting text-[24px] md:text-[30px]">
          Influencer <em>Search</em>
        </h1>
        <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
          Discover GCC creators across TikTok, Instagram, and YouTube. Results
          are AI-scored for fit with Kayan in a coming chunk.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <aside className="card">
          <FilterForm
            isSubmitting={search.isPending}
            onSubmit={onSubmit}
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
        </section>
      </div>
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

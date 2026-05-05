import { useState } from "react";
import { FilterForm } from "../features/influencers/components/FilterForm";
import { ResultsGrid } from "../features/influencers/components/ResultsGrid";
import { useCreatorSearch } from "../features/influencers/hooks/use-creator-search";
import type { CreatorResult, CreatorSearchFilters } from "../types/influencer";
import { logger } from "../utils/logger";

// Chunk 2 wiring: the form drives a mocked search hook (600ms delay, hard-
// coded results). Real Apify fan-out lands in Chunk 3 — only the hook body
// changes there; this page stays the same.
export default function InfluencerSearchPage(): JSX.Element {
  const search = useCreatorSearch();
  // Holds the most recent successful result set so the grid can keep
  // showing them across re-renders that aren't part of a new search.
  const [results, setResults] = useState<CreatorResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const onSubmit = async (filters: CreatorSearchFilters): Promise<void> => {
    setHasSearched(true);
    try {
      const data = await search.mutateAsync(filters);
      setResults(data);
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
          Discover GCC creators across TikTok, Instagram, and YouTube. Filters
          run against mock data this chunk — real Apify integration lands in
          the next one.
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

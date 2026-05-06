import { useState } from "react";
import { InfluencersTabs } from "../features/influencers/components/InfluencersTabs";
import { ResultsGrid } from "../features/influencers/components/ResultsGrid";
import {
  useSavedCreators,
  useRemoveSavedCreator,
} from "../features/influencers/hooks/use-saved-creators";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  type Platform,
} from "../constants/influencer";
import type { CardAction } from "../features/influencers/components/ResultCard";
import type { CreatorResult } from "../types/influencer";
import { logger } from "../utils/logger";

// Persistent shortlist view. Hooks the saved-creators GET endpoint, joins
// each row to its underlying creator_results record so the cards render
// the same way the Search results do — Remove button instead of Save.
export default function SavedCreatorsPage(): JSX.Element {
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const list = useSavedCreators(
    platformFilter === "all" ? undefined : platformFilter,
  );
  const removeCreator = useRemoveSavedCreator();

  // creatorResultId → savedRow.id, so the Remove button can find the row
  // it needs to delete given the underlying creator card.
  const savedRowByCreator = new Map<string, string>();
  for (const row of list.data ?? []) {
    savedRowByCreator.set(row.creatorResult.id, row.id);
  }

  const creators: CreatorResult[] = (list.data ?? []).map((s) => s.creatorResult);

  const onRemove = (creatorId: string): void => {
    const savedId = savedRowByCreator.get(creatorId);
    if (!savedId) return;
    removeCreator.mutate(savedId, {
      onError: (err) => {
        logger.error("remove saved creator failed", { err: String(err) });
      },
    });
  };

  const renderAction = (creator: CreatorResult): CardAction => ({
    kind: "remove",
    isPending: removeCreator.isPending,
    onClick: () => onRemove(creator.id),
  });

  const errorMessage = list.isError
    ? list.error instanceof Error
      ? list.error.message
      : "Failed to load saved creators."
    : null;

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12 space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="h-greeting text-[24px] md:text-[30px]">
            Saved <em>creators</em>
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
            Creators the team has flagged from search results. Remove to take
            them off the shortlist.
          </p>
        </div>
        <InfluencersTabs />
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <PlatformPill
          label="All"
          active={platformFilter === "all"}
          onClick={() => setPlatformFilter("all")}
        />
        {PLATFORMS.map((p) => (
          <PlatformPill
            key={p}
            label={PLATFORM_LABELS[p]}
            active={platformFilter === p}
            onClick={() => setPlatformFilter(p)}
          />
        ))}
      </div>

      <ResultsGrid
        results={creators}
        isLoading={list.isLoading}
        hasSearched={true}
        errorMessage={errorMessage}
        renderAction={renderAction}
        loadingMessage="Loading saved creators…"
        emptyMessage={
          platformFilter === "all"
            ? "No saved creators yet. Save creators from the Search tab to build your shortlist."
            : `No saved creators on ${PLATFORM_LABELS[platformFilter]}. Switch to All or save more.`
        }
      />
    </div>
  );
}

function PlatformPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip ${
        active ? "bg-obsidian text-yellow" : "chip-default hover:brightness-95"
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

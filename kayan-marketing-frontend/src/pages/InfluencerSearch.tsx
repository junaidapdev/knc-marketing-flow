import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { FilterForm } from "../features/influencers/components/FilterForm";
import { ResultsGrid } from "../features/influencers/components/ResultsGrid";
import { ResultsErrorBoundary } from "../features/influencers/components/ResultsErrorBoundary";
import { EstimateCostModal } from "../features/influencers/components/EstimateCostModal";
import { SearchCostFooter } from "../features/influencers/components/SearchCostFooter";
import { InfluencersTabs } from "../features/influencers/components/InfluencersTabs";
import { useCreatorSearch } from "../features/influencers/hooks/use-creator-search";
import { useEstimateCost } from "../features/influencers/hooks/use-estimate-cost";
import { useSaveCreator } from "../features/influencers/hooks/use-saved-creators";
import type { CardAction } from "../features/influencers/components/ResultCard";
import type {
  CreatorResult,
  CreatorSearchCostBreakdown,
  CreatorSearchFilters,
} from "../types/influencer";
import { logger } from "../utils/logger";

// Toast lifetime — long enough to read but short enough to not pile up
// when a user saves several creators in quick succession.
const TOAST_DURATION_MS = 2400;

interface Toast {
  id: number;
  kind: "success" | "error";
  message: string;
}

export default function InfluencerSearchPage(): JSX.Element {
  const search = useCreatorSearch();
  const estimate = useEstimateCost();
  const saveCreator = useSaveCreator();

  const [results, setResults] = useState<CreatorResult[]>([]);
  const [failureReasons, setFailureReasons] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [cost, setCost] = useState<CreatorSearchCostBreakdown | null>(null);

  // creator_results.id → "in flight" or "saved" — drives the per-card
  // button state. Cleared when the user runs a new search.
  const [savedCreatorIds, setSavedCreatorIds] = useState<Set<string>>(new Set());
  const [savingCreatorIds, setSavingCreatorIds] = useState<Set<string>>(new Set());

  const [estimateOpen, setEstimateOpen] = useState(false);
  const [pendingFilters, setPendingFilters] =
    useState<CreatorSearchFilters | null>(null);

  // Single-slot toast — replaced (not stacked) by the next save action so
  // a chatty save flow doesn't pile up.
  const [toast, setToast] = useState<Toast | null>(null);
  const showToast = (kind: Toast["kind"], message: string): void => {
    const t = { id: Date.now(), kind, message };
    setToast(t);
    window.setTimeout(() => {
      setToast((current) => (current?.id === t.id ? null : current));
    }, TOAST_DURATION_MS);
  };

  const runSearch = async (filters: CreatorSearchFilters): Promise<void> => {
    setHasSearched(true);
    setFailureReasons([]);
    setCost(null);
    setSavedCreatorIds(new Set());
    setSavingCreatorIds(new Set());
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

  // Optimistic Save: flip the card state immediately, fire the mutation,
  // revert on failure. The toast confirms either way.
  const onSave = (creator: CreatorResult): void => {
    if (savedCreatorIds.has(creator.id) || savingCreatorIds.has(creator.id)) return;
    setSavingCreatorIds((s) => {
      const next = new Set(s);
      next.add(creator.id);
      return next;
    });
    saveCreator.mutate(creator.id, {
      onSuccess: () => {
        setSavedCreatorIds((s) => {
          const next = new Set(s);
          next.add(creator.id);
          return next;
        });
        showToast("success", `Saved @${creator.handle}`);
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : "Save failed.";
        showToast("error", `Couldn't save @${creator.handle}: ${message}`);
        logger.error("save creator failed", { err: String(err) });
      },
      onSettled: () => {
        setSavingCreatorIds((s) => {
          const next = new Set(s);
          next.delete(creator.id);
          return next;
        });
      },
    });
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

  const renderAction = (creator: CreatorResult): CardAction => ({
    kind: "save",
    isSaved: savedCreatorIds.has(creator.id),
    isPending: savingCreatorIds.has(creator.id),
    onClick: () => onSave(creator),
  });

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12 space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="h-greeting text-[24px] md:text-[30px]">
            Influencer <em>Search</em>
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
            Discover GCC creators across TikTok, Instagram, and YouTube. AI-
            scored for fit with Kayan; cost is previewable before each run.
          </p>
        </div>
        <InfluencersTabs />
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
          <ResultsErrorBoundary>
            <ResultsGrid
              results={results}
              isLoading={search.isPending}
              hasSearched={hasSearched}
              errorMessage={errorMessage}
              renderAction={renderAction}
              preSearchMessage="Set your filters and run a search to discover GCC creators across TikTok, Instagram, and YouTube."
            />
          </ResultsErrorBoundary>
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

      {toast && <ToastBanner toast={toast} />}
    </div>
  );
}

// Fixed-position bottom-right toast. Swapped (not stacked) by the next
// save event so chatty interactions don't pile up.
function ToastBanner({ toast }: { toast: Toast }): JSX.Element {
  const isSuccess = toast.kind === "success";
  const Icon = isSuccess ? Check : AlertTriangle;
  return (
    <div
      role={isSuccess ? "status" : "alert"}
      className={`fixed bottom-4 right-4 left-4 sm:left-auto z-50 sm:max-w-sm rounded-md shadow-lg px-3 py-2 text-[13px] flex items-start gap-2 ${
        isSuccess
          ? "bg-sage text-[#2C5530] border border-sage-deep/30"
          : "bg-rose text-[#6E2A35] border border-rose-deep/30"
      }`}
    >
      <Icon size={14} className="mt-0.5 flex-shrink-0" />
      <span>{toast.message}</span>
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

import { X, Sparkles, Loader2 } from "lucide-react";
import type { CreatorSearchEstimate } from "../../../types/influencer";

// Pre-search cost-preview modal. Shows the estimate breakdown + a
// "Proceed with search" CTA that triggers the real paid run. Cancel
// button closes the modal without spending anything.

interface Props {
  isOpen: boolean;
  isLoading: boolean;
  estimate: CreatorSearchEstimate | null;
  errorMessage: string | null;
  onClose: () => void;
  onProceed: () => void;
}

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function EstimateCostModal({
  isOpen,
  isLoading,
  estimate,
  errorMessage,
  onClose,
  onProceed,
}: Props): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-paper rounded-lg shadow-lg text-ink max-h-[90vh] overflow-y-auto canvas-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <h2 className="font-serif text-[19px] tracking-tight text-ink">
              Estimated cost
            </h2>
            <p className="text-[12px] text-ink-3 mt-0.5">
              Approximate Apify + Claude spend before you run the search.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </header>

        <div className="px-5 py-5 space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-[13px] text-ink-3">
              <Loader2 size={14} className="animate-spin" />
              Calculating…
            </div>
          )}

          {errorMessage && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-3 py-2 text-[12.5px]">
              {errorMessage}
            </div>
          )}

          {estimate && !isLoading && (
            <>
              <div className="rounded-md border border-line p-4 bg-cream-2/40 space-y-2">
                <Row label="Apify scrapers" value={formatUsd(estimate.apifyCostUsd)} />
                <Row label="Claude scoring" value={formatUsd(estimate.claudeCostUsd)} />
                <div className="border-t border-line pt-2 mt-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-ink">Total</span>
                  <span className="text-[18px] font-serif font-semibold text-ink">
                    {formatUsd(estimate.totalCostUsd)}
                  </span>
                </div>
              </div>

              {estimate.assumptions.length > 0 && (
                <div>
                  <div className="eyebrow mb-1.5">Assumptions</div>
                  <ul className="space-y-1">
                    {estimate.assumptions.map((a, i) => (
                      <li key={i} className="text-[12px] text-ink-3 leading-snug">
                        • {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="flex justify-end gap-2 px-5 py-4 border-t border-line">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={onProceed}
            disabled={!estimate || isLoading}
            className="btn btn-primary disabled:opacity-50"
          >
            <Sparkles size={14} />
            Proceed with search
          </button>
        </footer>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ink-2">{label}</span>
      <span className="text-ink font-semibold tabular-nums">{value}</span>
    </div>
  );
}

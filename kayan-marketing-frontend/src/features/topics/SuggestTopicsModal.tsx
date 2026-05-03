import { useState } from "react";
import { X, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { TOPIC_OCCASIONS, TOPIC_OCCASION_LABELS, type TopicOccasion } from "../../constants/topics";
import { useSuggestTopics } from "./hooks/use-topics";
import { logger } from "../../utils/logger";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SuggestTopicsModal({ isOpen, onClose }: Props): JSX.Element | null {
  const [count, setCount] = useState(5);
  const [occasion, setOccasion] = useState<TopicOccasion>("regular");
  const [error, setError] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);
  const suggest = useSuggestTopics();

  if (!isOpen) return null;

  const handleGenerate = async (): Promise<void> => {
    setError(null);
    setGeneratedCount(null);
    try {
      const result = await suggest.mutateAsync({
        count,
        occasion,
      });
      setGeneratedCount(result.generated);
      // Auto-close on success after a brief moment so the user sees the
      // result, then the new topics show up in the list behind.
      window.setTimeout(() => {
        onClose();
        setGeneratedCount(null);
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
      logger.error("topic suggestion failed", { err: String(err) });
    }
  };

  const isPending = suggest.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={isPending ? undefined : onClose}
    >
      <div
        className="w-full max-w-md bg-paper rounded-lg shadow-lg text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-obsidian text-yellow grid place-items-center">
              <Sparkles size={14} />
            </div>
            <div>
              <h2 className="font-serif text-[17px] tracking-tight text-ink">
                Suggest topics with AI
              </h2>
              <p className="text-[11.5px] text-ink-3 mt-0.5">
                Brand DNA + recent activity → fresh ideas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
            className="iconbtn disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-5 space-y-5">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="field-label !mb-0">How many ideas?</label>
              <span className="font-serif text-[20px] text-ink leading-none">{count}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={isPending}
              className="w-full accent-obsidian"
            />
            <div className="flex justify-between text-[10.5px] text-ink-3 mt-1">
              <span>1</span>
              <span>10</span>
            </div>
          </div>

          <div>
            <label className="field-label">Bias toward occasion</label>
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value as TopicOccasion)}
              disabled={isPending}
              className="form-select"
            >
              {TOPIC_OCCASIONS.map((o) => (
                <option key={o} value={o}>
                  {TOPIC_OCCASION_LABELS[o]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-3 mt-1.5 italic">
              "Regular" = no bias; the AI picks freely from current opportunities.
            </p>
          </div>

          {/* Loading / error / success states */}
          {isPending && (
            <div className="flex items-center gap-2.5 text-[12.5px] text-ink-2 bg-cream-2/50 rounded-md px-3 py-2.5">
              <Loader2 size={14} className="animate-spin text-obsidian" />
              <span>Generating ideas based on your brand DNA and recent activity…</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-[12px] text-rose-deep bg-rose/30 border border-rose-deep/30 rounded-md px-3 py-2">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {generatedCount !== null && !error && (
            <div className="text-[12.5px] text-sage-deep bg-sage/30 rounded-md px-3 py-2">
              ✓ Saved {generatedCount} new topic{generatedCount === 1 ? "" : "s"} to your queue.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-4 border-t border-line">
          <button onClick={onClose} disabled={isPending} className="btn btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
          >
            <Sparkles size={14} className={isPending ? "animate-pulse" : ""} />
            {isPending ? "Generating…" : `Generate ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
}

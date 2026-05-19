import { useState } from "react";
import { X, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { TOPIC_OCCASIONS, TOPIC_OCCASION_LABELS, type TopicOccasion } from "../../constants/topics";
import {
  TOPIC_GENERATION_MODE_CONFIG,
  TOPIC_GENERATION_MODE_VALUES,
  TOPIC_GENERATION_MODES,
  type TopicGenerationMode,
} from "../../constants/topic-generation";
import { useSuggestTopics } from "./hooks/use-topics";
import { logger } from "../../utils/logger";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SuggestTopicsModal({ isOpen, onClose }: Props): JSX.Element | null {
  const [count, setCount] = useState(5);
  const [occasion, setOccasion] = useState<TopicOccasion>("regular");
  const [mode, setMode] = useState<TopicGenerationMode>(TOPIC_GENERATION_MODES.BALANCED);
  const [productFocus, setProductFocus] = useState("");
  const [audienceFocus, setAudienceFocus] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<{
    saved: number;
    reviewed: number;
    rejected: number;
    averageScore: number | null;
  } | null>(null);
  const suggest = useSuggestTopics();

  if (!isOpen) return null;

  const handleGenerate = async (): Promise<void> => {
    setError(null);
    setGenerationResult(null);
    try {
      const result = await suggest.mutateAsync({
        count,
        occasion,
        mode,
        productFocus: productFocus.trim() || undefined,
        audienceFocus: audienceFocus.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      const duplicateRejects = result.duplicatesSkipped ?? result.skipped.length;
      const rejected = (result.rejected ?? 0) + duplicateRejects;
      setGenerationResult({
        saved: result.saved ?? result.generated,
        reviewed: result.reviewed ?? result.generated,
        rejected,
        averageScore: result.averageScore ?? null,
      });
      // Auto-close on success after a brief moment so the user sees the
      // result, then the new topics show up in the list behind.
      window.setTimeout(() => {
        onClose();
        setGenerationResult(null);
      }, rejected > 0 ? 2200 : 1600);
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
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-paper rounded-lg shadow-lg text-ink"
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
                Strategic lanes + memory guard → fresher ideas.
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
            <label className="field-label">Generation mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as TopicGenerationMode)}
              disabled={isPending}
              className="form-select"
            >
              {TOPIC_GENERATION_MODE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {TOPIC_GENERATION_MODE_CONFIG[value].label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-3 mt-1.5 italic">
              {TOPIC_GENERATION_MODE_CONFIG[mode].description}
            </p>
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Product focus</label>
              <input
                value={productFocus}
                onChange={(e) => setProductFocus(e.target.value)}
                disabled={isPending}
                maxLength={200}
                placeholder="Example: Ramadan chocolates"
                className="form-input"
              />
            </div>
            <div>
              <label className="field-label">Audience focus</label>
              <input
                value={audienceFocus}
                onChange={(e) => setAudienceFocus(e.target.value)}
                disabled={isPending}
                maxLength={200}
                placeholder="Example: families, students"
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Notes / direction</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              maxLength={1200}
              rows={3}
              placeholder="Anything the creator wants the next batch to explore or avoid."
              className="form-textarea"
            />
            <p className="text-[11px] text-ink-3 mt-1.5 italic">
              Modes force variety across lanes so regeneration does not circle the same ideas.
            </p>
          </div>

          {/* Loading / error / success states */}
          {isPending && (
            <div className="flex items-center gap-2.5 text-[12.5px] text-ink-2 bg-cream-2/50 rounded-md px-3 py-2.5">
              <Loader2 size={14} className="animate-spin text-obsidian" />
              <span>Generating strategic ideas with mode, lanes, and duplicate checks…</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-[12px] text-rose-deep bg-rose/30 border border-rose-deep/30 rounded-md px-3 py-2">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {generationResult !== null && !error && (
            <div className="text-[12.5px] text-sage-deep bg-sage/30 rounded-md px-3 py-2">
              ✓ Saved {generationResult.saved} strong idea{generationResult.saved === 1 ? "" : "s"}.
              {" "}Reviewed {generationResult.reviewed}.
              {" "}Rejected {generationResult.rejected} weak/repeated idea{generationResult.rejected === 1 ? "" : "s"}.
              {generationResult.averageScore !== null
                ? ` Average score ${generationResult.averageScore}/10.`
                : ""}
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

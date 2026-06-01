import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import {
  MONTHLY_VIDEO_PLAN_COPY,
  MONTHLY_VIDEO_PLAN_COUNT_MAX,
  MONTHLY_VIDEO_PLAN_COUNT_MIN,
  MONTHLY_VIDEO_PLAN_LABEL_MAX_LENGTH,
} from "../../constants/monthly-video-plan";
import { logger } from "../../utils/logger";

interface Props {
  onAdd: (input: {
    label: string;
    count: number;
    countMax: number | null;
  }) => Promise<void>;
  disabled?: boolean;
}

export function AddItemRow({ onAdd, disabled }: Props): JSX.Element {
  const [count, setCount] = useState<string>("");
  const [countMax, setCountMax] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setCount("");
    setCountMax("");
    setLabel("");
    setError(null);
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError("Add a label.");
      return;
    }
    if (trimmedLabel.length > MONTHLY_VIDEO_PLAN_LABEL_MAX_LENGTH) {
      setError("Label is too long.");
      return;
    }

    const countNum = Number(count);
    if (
      !Number.isInteger(countNum) ||
      countNum < MONTHLY_VIDEO_PLAN_COUNT_MIN ||
      countNum > MONTHLY_VIDEO_PLAN_COUNT_MAX
    ) {
      setError("Enter a count between 1 and 999.");
      return;
    }

    let maxNum: number | null = null;
    if (countMax.trim() !== "") {
      const n = Number(countMax);
      if (
        !Number.isInteger(n) ||
        n < MONTHLY_VIDEO_PLAN_COUNT_MIN ||
        n > MONTHLY_VIDEO_PLAN_COUNT_MAX
      ) {
        setError("Max must be an integer between 1 and 999.");
        return;
      }
      if (n < countNum) {
        setError("Max must be ≥ count.");
        return;
      }
      maxNum = n === countNum ? null : n;
    }

    setBusy(true);
    try {
      await onAdd({ label: trimmedLabel, count: countNum, countMax: maxNum });
      reset();
    } catch (err) {
      logger.error("add item failed", { err: String(err) });
      setError(err instanceof Error ? err.message : "Couldn't add item.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-4 py-2.5 space-y-2 bg-cream/30">
      <div className="flex flex-wrap gap-2 items-stretch">
        <input
          type="number"
          inputMode="numeric"
          min={MONTHLY_VIDEO_PLAN_COUNT_MIN}
          max={MONTHLY_VIDEO_PLAN_COUNT_MAX}
          placeholder={MONTHLY_VIDEO_PLAN_COPY.addRowCountPlaceholder}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          disabled={disabled || busy}
          className="w-[80px] rounded-[8px] border border-line bg-paper px-3 py-1.5 text-[13.5px] text-ink tabular-nums focus:outline-none focus:ring-2 focus:ring-yellow/50"
          aria-label={MONTHLY_VIDEO_PLAN_COPY.addRowCountPlaceholder}
          required
        />
        <input
          type="number"
          inputMode="numeric"
          min={MONTHLY_VIDEO_PLAN_COUNT_MIN}
          max={MONTHLY_VIDEO_PLAN_COUNT_MAX}
          placeholder={MONTHLY_VIDEO_PLAN_COPY.addRowMaxPlaceholder}
          value={countMax}
          onChange={(e) => setCountMax(e.target.value)}
          disabled={disabled || busy}
          className="w-[110px] rounded-[8px] border border-line bg-paper px-3 py-1.5 text-[13.5px] text-ink tabular-nums focus:outline-none focus:ring-2 focus:ring-yellow/50"
          aria-label={MONTHLY_VIDEO_PLAN_COPY.addRowMaxPlaceholder}
        />
        <input
          type="text"
          maxLength={MONTHLY_VIDEO_PLAN_LABEL_MAX_LENGTH}
          placeholder={MONTHLY_VIDEO_PLAN_COPY.addRowLabelPlaceholder}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={disabled || busy}
          className="flex-1 min-w-[160px] rounded-[8px] border border-line bg-paper px-3 py-1.5 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-yellow/50"
          aria-label={MONTHLY_VIDEO_PLAN_COPY.addRowLabelPlaceholder}
          required
        />
        <button
          type="submit"
          disabled={disabled || busy}
          className="btn btn-primary text-[12.5px] px-3 py-1.5"
        >
          <Plus size={13} />
          <span>{MONTHLY_VIDEO_PLAN_COPY.addRowButton}</span>
        </button>
      </div>
      {error && <div className="text-[12px] text-rose-deep">{error}</div>}
    </form>
  );
}

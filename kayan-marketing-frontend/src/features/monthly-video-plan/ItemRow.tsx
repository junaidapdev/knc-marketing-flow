import { useState, type FormEvent } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  MONTHLY_VIDEO_PLAN_COPY,
  MONTHLY_VIDEO_PLAN_COUNT_MAX,
  MONTHLY_VIDEO_PLAN_COUNT_MIN,
  MONTHLY_VIDEO_PLAN_LABEL_MAX_LENGTH,
} from "../../constants/monthly-video-plan";
import { logger } from "../../utils/logger";
import type { MonthlyVideoPlanItem } from "../../types/monthly-video-plan";
import { formatItemCount } from "./utils/format-count";

interface Props {
  item: MonthlyVideoPlanItem;
  onSave: (patch: {
    id: string;
    label: string;
    count: number;
    countMax: number | null;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ItemRow({ item, onSave, onDelete }: Props): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [count, setCount] = useState(String(item.count));
  const [countMax, setCountMax] = useState(
    item.countMax != null ? String(item.countMax) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (): void => {
    setLabel(item.label);
    setCount(String(item.count));
    setCountMax(item.countMax != null ? String(item.countMax) : "");
    setError(null);
    setEditing(true);
  };

  const cancelEdit = (): void => {
    setEditing(false);
    setError(null);
  };

  const handleSave = async (e: FormEvent): Promise<void> => {
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
      await onSave({
        id: item.id,
        label: trimmedLabel,
        count: countNum,
        countMax: maxNum,
      });
      setEditing(false);
    } catch (err) {
      logger.error("save item failed", { err: String(err) });
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setBusy(true);
    try {
      await onDelete(item.id);
    } catch (err) {
      logger.error("delete item failed", { err: String(err) });
      setError(err instanceof Error ? err.message : "Couldn't delete.");
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="px-4 py-3 space-y-2 bg-cream-2/40 ring-1 ring-inset ring-yellow/40"
      >
        <div className="flex flex-wrap gap-2 items-stretch">
          <input
            type="number"
            inputMode="numeric"
            min={MONTHLY_VIDEO_PLAN_COUNT_MIN}
            max={MONTHLY_VIDEO_PLAN_COUNT_MAX}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            disabled={busy}
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
            disabled={busy}
            className="w-[110px] rounded-[8px] border border-line bg-paper px-3 py-1.5 text-[13.5px] text-ink tabular-nums focus:outline-none focus:ring-2 focus:ring-yellow/50"
            aria-label={MONTHLY_VIDEO_PLAN_COPY.addRowMaxPlaceholder}
          />
          <input
            type="text"
            maxLength={MONTHLY_VIDEO_PLAN_LABEL_MAX_LENGTH}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={busy}
            className="flex-1 min-w-[160px] rounded-[8px] border border-line bg-paper px-3 py-1.5 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-yellow/50"
            aria-label={MONTHLY_VIDEO_PLAN_COPY.addRowLabelPlaceholder}
            required
            autoFocus
          />
          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary text-[12.5px] px-3 py-1.5"
          >
            <Check size={13} />
            <span>{MONTHLY_VIDEO_PLAN_COPY.itemSaveLabel}</span>
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={busy}
            className="btn btn-ghost text-[12.5px] px-3 py-1.5"
          >
            <X size={13} />
            <span>{MONTHLY_VIDEO_PLAN_COPY.itemCancelLabel}</span>
          </button>
        </div>
        {error && <div className="text-[12px] text-rose-deep">{error}</div>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-cream-2/30 transition-colors">
      <div className="font-serif text-[19px] leading-none text-ink tabular-nums min-w-[44px] text-right">
        {formatItemCount(item.count, item.countMax)}
      </div>
      <div className="flex-1 min-w-0 text-[14px] text-ink truncate">
        {item.label}
      </div>
      <div className="flex items-center gap-0.5 -mr-1">
        {confirmingDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="btn btn-primary text-[12px] px-2.5 py-1"
            >
              {MONTHLY_VIDEO_PLAN_COPY.deleteConfirmConfirm}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
              className="btn btn-ghost text-[12px] px-2.5 py-1"
            >
              {MONTHLY_VIDEO_PLAN_COPY.deleteConfirmCancel}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startEdit}
              aria-label={MONTHLY_VIDEO_PLAN_COPY.itemEditLabel}
              title={MONTHLY_VIDEO_PLAN_COPY.itemEditLabel}
              className="iconbtn opacity-60 hover:opacity-100"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={MONTHLY_VIDEO_PLAN_COPY.itemDeleteLabel}
              title={MONTHLY_VIDEO_PLAN_COPY.itemDeleteLabel}
              className="iconbtn opacity-60 hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

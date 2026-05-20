import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  // Auto-dismiss window. Defaults to 10s to match the QuickBook contract.
  duration?: number;
}

// Floating bottom-center snackbar with a 10-second "Undo" affordance.
// Rendered via portal so it survives any parent overflow/transform that
// would otherwise clip a fixed-position element.
export function UndoToast({
  message,
  onUndo,
  onDismiss,
  duration = 10000,
}: UndoToastProps): JSX.Element {
  // useRef avoids a clear/reset race when the parent re-renders before
  // the timer fires.
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setTimeout(onDismiss, duration);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [duration, onDismiss]);

  const handleUndo = (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    onUndo();
  };

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-obsidian text-cream rounded-full pl-4 pr-1.5 py-1.5 shadow-lg flex items-center gap-3 text-[13px] max-w-[90vw]"
    >
      <span className="truncate">{message}</span>
      <button
        type="button"
        onClick={handleUndo}
        className="bg-yellow text-obsidian text-[12px] font-bold rounded-full px-3 py-1 hover:brightness-95 transition"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="w-7 h-7 grid place-items-center rounded-full text-ink-3 hover:text-cream hover:bg-white/10 transition"
      >
        <X size={14} />
      </button>
    </div>,
    document.body,
  );
}

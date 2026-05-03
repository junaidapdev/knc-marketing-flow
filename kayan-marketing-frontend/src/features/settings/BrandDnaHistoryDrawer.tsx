import { useState } from "react";
import { X, Eye, RotateCcw, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { format, formatDistanceToNow, isAfter, subDays } from "date-fns";
import {
  useBrandDnaHistory,
  useBrandDnaHistoryEntry,
  useRestoreBrandDna,
} from "./hooks";
import type { BrandDnaHistoryEntry } from "./types";
import { logger } from "../../utils/logger";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Show "2 hours ago" for the last week, then switch to absolute dates
// (relative beyond a week starts to feel imprecise — "23 days ago" is harder
// to act on than "Apr 10").
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const sevenDaysAgo = subDays(new Date(), 7);
  if (isAfter(date, sevenDaysAgo)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

export function BrandDnaHistoryDrawer({ isOpen, onClose }: Props): JSX.Element | null {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const list = useBrandDnaHistory(50);
  const restore = useRestoreBrandDna();

  if (!isOpen) return null;

  const handleRestore = async (entry: BrandDnaHistoryEntry): Promise<void> => {
    const ok = window.confirm(
      "Restore this version? Your current DNA will be saved to history and replaced with this snapshot.",
    );
    if (!ok) return;
    setRestoreError(null);
    setRestoringId(entry.id);
    try {
      await restore.mutateAsync(entry.id);
      // Close the drawer so the user lands on the editor showing the
      // restored content immediately (the BrandDnaSection re-hydrates
      // from useBrandDna which we just invalidated).
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Restore failed.";
      setRestoreError(message);
      logger.error("brand DNA restore failed", { err: String(err) });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-paper border-l border-line shadow-2xl flex flex-col"
        role="dialog"
        aria-label="Brand DNA history"
      >
        <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-line">
          <div>
            <h2 className="font-serif text-[18px] tracking-tight text-ink leading-tight">
              Brand DNA — edit history
            </h2>
            <p className="text-[11.5px] text-ink-3 mt-0.5">
              Last 50 saves. Click View to inspect; Restore to roll back.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="iconbtn flex-shrink-0"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto canvas-scroll px-4 sm:px-5 py-4">
          {restoreError && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-3 text-[12.5px] mb-4 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{restoreError}</span>
            </div>
          )}

          {list.isLoading && (
            <p className="text-ink-3 text-[13px]">Loading history…</p>
          )}
          {list.isError && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-3 text-[13px]">
              {list.error instanceof Error ? list.error.message : "Failed to load history."}
            </div>
          )}
          {list.data && list.data.length === 0 && (
            <div className="text-center py-8 text-ink-3 text-[13px]">
              No history yet. Your first save will create the earliest entry here.
            </div>
          )}
          {list.data && list.data.length > 0 && (
            <ul className="space-y-2">
              {list.data.map((entry) => (
                <li
                  key={entry.id}
                  className="card p-3.5 hover:border-line-2 transition"
                >
                  <div className="text-[12.5px] text-ink font-semibold">
                    {formatTimestamp(entry.createdAt)}
                    {entry.editorName && (
                      <span className="text-ink-3 font-normal ml-1.5">
                        — {entry.editorName}
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-ink-2 mt-1.5 italic">
                    {entry.changeNote ?? <span className="text-ink-3">(no note)</span>}
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setPreviewId(entry.id)}
                      className="text-[12px] text-ink-2 hover:text-ink px-2 py-1 inline-flex items-center gap-1"
                    >
                      <Eye size={12} />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestore(entry)}
                      disabled={restoringId === entry.id}
                      className="text-[12px] text-obsidian hover:underline px-2 py-1 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      {restoringId === entry.id ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Restoring…
                        </>
                      ) : (
                        <>
                          <RotateCcw size={12} />
                          Restore
                        </>
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {previewId && (
        <HistoryPreviewModal id={previewId} onClose={() => setPreviewId(null)} />
      )}
    </>
  );
}

interface PreviewProps {
  id: string;
  onClose: () => void;
}

function HistoryPreviewModal({ id, onClose }: PreviewProps): JSX.Element {
  const detail = useBrandDnaHistoryEntry(id);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-paper rounded-lg shadow-lg text-ink max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-line">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"
          >
            <ArrowLeft size={14} />
            Back to history
          </button>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto canvas-scroll px-4 sm:px-5 py-4 space-y-4">
          {detail.isLoading && (
            <p className="text-ink-3 text-[13px]">Loading version…</p>
          )}
          {detail.isError && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-3 text-[13px]">
              {detail.error instanceof Error ? detail.error.message : "Failed to load version."}
            </div>
          )}
          {detail.data && (
            <>
              <header>
                <h3 className="font-serif text-[16px] text-ink leading-tight">
                  {formatTimestamp(detail.data.createdAt)}
                  {detail.data.editorName && (
                    <span className="text-ink-3 font-normal ml-1.5">
                      — {detail.data.editorName}
                    </span>
                  )}
                </h3>
                {detail.data.changeNote && (
                  <p className="text-[13px] text-ink-2 mt-1 italic">
                    "{detail.data.changeNote}"
                  </p>
                )}
              </header>

              <section>
                <div className="eyebrow mb-2">DNA markdown</div>
                <pre className="text-[12px] font-mono leading-relaxed bg-cream-2/40 border border-line rounded-md p-3 overflow-auto max-h-[40vh] whitespace-pre-wrap break-words">
                  {detail.data.dnaMarkdown || "(empty)"}
                </pre>
              </section>

              <section>
                <div className="eyebrow mb-2">Voice config</div>
                <pre className="text-[12px] font-mono leading-relaxed bg-cream-2/40 border border-line rounded-md p-3 overflow-auto max-h-[30vh]">
                  {Object.keys(detail.data.voiceConfig).length === 0
                    ? "(empty)"
                    : JSON.stringify(detail.data.voiceConfig, null, 2)}
                </pre>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

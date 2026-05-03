import { useEffect, useMemo, useState } from "react";
import { Save, Check, AlertCircle, History as HistoryIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useBrandDna, useUpdateBrandDna } from "./hooks";
import { BrandDnaHistoryDrawer } from "./BrandDnaHistoryDrawer";
import { logger } from "../../utils/logger";

const SHORT_DNA_THRESHOLD = 500;
const REQUIRED_VOICE_KEYS = ["anchor_price", "branches"] as const;

// Pretty-print voice config so the editor opens with readable indentation.
// Falls back to "{}" for first-time loads where voice_config is empty/null.
function stringifyVoiceConfig(config: Record<string, unknown>): string {
  if (!config || Object.keys(config).length === 0) return "{}";
  return JSON.stringify(config, null, 2);
}

interface JsonState {
  parsed: Record<string, unknown> | null;
  error: string | null;
}

function parseJsonSafe(text: string): JsonState {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { parsed: null, error: "Voice config must be a JSON object." };
    }
    return { parsed: parsed as Record<string, unknown>, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON.";
    return { parsed: null, error: message };
  }
}

export function BrandDnaSection(): JSX.Element {
  const dna = useBrandDna();
  const update = useUpdateBrandDna();

  const [dnaDraft, setDnaDraft] = useState<string>("");
  const [voiceDraft, setVoiceDraft] = useState<string>("{}");
  const [changeNote, setChangeNote] = useState<string>("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Hydrate the form when the API call settles. We replace the local state
  // wholesale on every successful fetch — the user's only source of truth is
  // what's currently saved, so no merge logic needed.
  useEffect(() => {
    if (!dna.data) return;
    setDnaDraft(dna.data.dnaMarkdown ?? "");
    setVoiceDraft(stringifyVoiceConfig(dna.data.voiceConfig ?? {}));
    setChangeNote("");
    setError(null);
  }, [dna.data]);

  const jsonState = useMemo(() => parseJsonSafe(voiceDraft), [voiceDraft]);

  const dnaDirty = dna.data ? dnaDraft !== (dna.data.dnaMarkdown ?? "") : false;
  const voiceDirty = dna.data
    ? voiceDraft.trim() !== stringifyVoiceConfig(dna.data.voiceConfig ?? {}).trim()
    : false;
  const isDirty = dnaDirty || voiceDirty;

  const dnaCharCount = dnaDraft.length;
  const dnaTooLong = dnaCharCount > 100000;
  const dnaEmpty = dnaDraft.trim().length === 0;

  // Block save outright if both fields are blanked or JSON is invalid;
  // soft-warn (confirm prompt) for short DNA + missing voice keys.
  const cannotSave =
    !isDirty || jsonState.error !== null || dnaTooLong || dnaEmpty || update.isPending;

  const onCancel = (): void => {
    if (!dna.data) return;
    setDnaDraft(dna.data.dnaMarkdown ?? "");
    setVoiceDraft(stringifyVoiceConfig(dna.data.voiceConfig ?? {}));
    setChangeNote("");
    setError(null);
  };

  const onSave = async (): Promise<void> => {
    setError(null);

    if (jsonState.error || !jsonState.parsed) {
      setError("Voice config is not valid JSON. Fix it before saving.");
      return;
    }
    if (dnaEmpty) {
      setError("Brand DNA cannot be empty. Saving an empty DNA would break AI generation.");
      return;
    }

    // Soft warnings — give the user a chance to cancel.
    if (dnaCharCount < SHORT_DNA_THRESHOLD) {
      const ok = window.confirm(
        `The brand DNA is ${dnaCharCount} characters — much shorter than usual (typical is 5,000+). Save anyway?`,
      );
      if (!ok) return;
    }
    const missingKeys = REQUIRED_VOICE_KEYS.filter((k) => !(k in jsonState.parsed!));
    if (missingKeys.length > 0) {
      const ok = window.confirm(
        `Voice config is missing key(s) the AI relies on: ${missingKeys.join(", ")}. Save anyway?`,
      );
      if (!ok) return;
    }

    try {
      await update.mutateAsync({
        dnaMarkdown: dnaDraft,
        voiceConfig: jsonState.parsed,
        changeNote: changeNote.trim().length > 0 ? changeNote.trim() : null,
      });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      setError(message);
      logger.error("brand DNA save failed", { err: String(err) });
    }
  };

  if (dna.isLoading) {
    return <p className="text-ink-3 text-[13px]">Loading brand DNA…</p>;
  }
  if (dna.isError) {
    return (
      <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 text-[13px]">
        {dna.error instanceof Error ? dna.error.message : "Failed to load brand DNA."}
      </div>
    );
  }
  if (!dna.data) return <></>;

  const lastEditedDate = dna.data.updatedAt ? new Date(dna.data.updatedAt) : null;

  return (
    <>
      <div className="space-y-5">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="h-card">Brand DNA</h2>
            <p className="text-[12.5px] text-ink-3 mt-0.5">
              The system prompt the AI reads on every Generate call. Edit, save, and
              new generations use the updated content immediately.
            </p>
            {lastEditedDate && (
              <p className="text-[11.5px] text-ink-3 mt-1.5">
                Last edited {format(lastEditedDate, "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="btn btn-ghost"
          >
            <HistoryIcon size={13} />
            View history
          </button>
        </header>

        {/* DNA markdown */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between flex-wrap gap-1">
            <label className="field-label !mb-0" htmlFor="dna-markdown">
              DNA markdown
            </label>
            <span
              className={`text-[11px] tabular-nums ${
                dnaTooLong
                  ? "text-rose-deep font-semibold"
                  : dnaCharCount < SHORT_DNA_THRESHOLD
                    ? "text-ink-3 italic"
                    : "text-ink-3"
              }`}
            >
              {dnaCharCount.toLocaleString()} / 100,000 chars
            </span>
          </div>
          <p className="text-[11.5px] text-ink-3 italic">
            Paste your Recipe Book content here. Markdown syntax supported.
          </p>
          <textarea
            id="dna-markdown"
            value={dnaDraft}
            onChange={(e) => setDnaDraft(e.target.value)}
            rows={25}
            placeholder="# KAYAN SWEETS — BRAND DNA &amp; RECIPE BOOK V…"
            className="form-textarea font-mono text-[12.5px] sm:text-[13px] leading-relaxed focus:ring-2 focus:ring-yellow"
          />
          {dnaTooLong && (
            <p className="text-[11.5px] text-rose-deep flex items-center gap-1">
              <AlertCircle size={11} />
              Over the 100,000 character limit. Trim before saving.
            </p>
          )}
        </section>

        {/* Voice config JSON */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between flex-wrap gap-1">
            <label className="field-label !mb-0" htmlFor="voice-config">
              Voice config (JSON)
            </label>
            {jsonState.error ? (
              <span className="text-[11px] text-rose-deep flex items-center gap-1">
                <AlertCircle size={11} />
                Invalid JSON: {jsonState.error}
              </span>
            ) : (
              <span className="text-[11px] text-sage-deep flex items-center gap-1">
                <Check size={11} />
                Valid JSON
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-ink-3 italic">
            Structured voice rules. The AI reads <code>anchor_price</code>,{" "}
            <code>branches</code>, and <code>patterns</code> by name. Other keys are
            preserved verbatim.
          </p>
          <textarea
            id="voice-config"
            value={voiceDraft}
            onChange={(e) => setVoiceDraft(e.target.value)}
            rows={15}
            spellCheck={false}
            className={`form-textarea font-mono text-[12.5px] sm:text-[13px] leading-relaxed focus:ring-2 ${
              jsonState.error ? "focus:ring-rose-deep" : "focus:ring-yellow"
            }`}
          />
        </section>

        {/* Change note */}
        <section>
          <label className="field-label" htmlFor="change-note">
            Change note <span className="text-ink-3 font-normal">(optional)</span>
          </label>
          <input
            id="change-note"
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            maxLength={500}
            placeholder='e.g., "Added P10 from Reel 12 analysis"'
            className="form-input"
          />
          <p className="text-[11px] text-ink-3 mt-1 italic">
            Helps you find this version in history later.
          </p>
        </section>

        {error && (
          <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-3 text-[12.5px] flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
          {savedFlash && !error && (
            <span className="flex items-center gap-1.5 text-[13px] text-sage-deep">
              <Check size={14} />
              Saved — future AI generations will use the new content.
            </span>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={!isDirty || update.isPending}
            className="btn btn-ghost disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={cannotSave}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {update.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save size={14} />
                Save changes
              </>
            )}
          </button>
        </div>
      </div>

      <BrandDnaHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}

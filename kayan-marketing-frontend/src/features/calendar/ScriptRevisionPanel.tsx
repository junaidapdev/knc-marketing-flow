import { useMemo, useState } from "react";
import { Check, RefreshCcw, Sparkles, X } from "lucide-react";
import { z } from "zod";
import {
  SCRIPT_REVISION_COPY,
  SCRIPT_REVISION_LIMITS,
  SCRIPT_REVISION_QUICK_FIXES,
  type ScriptRevisionQuickFix,
} from "../../constants/script-revision";
import type { ScriptRevision } from "../../types/script-revision";
import { logger } from "../../utils/logger";
import { RenderedMarkdown } from "./RenderedMarkdown";
import { useCreateScriptRevision } from "./hooks/use-script-revisions";

interface Props {
  entryId: string;
  currentScript: string;
  onApplyRevision: (script: string) => Promise<void>;
}

const revisionInputSchema = z
  .object({
    currentScript: z
      .string()
      .trim()
      .min(1, SCRIPT_REVISION_COPY.emptyCurrentScript),
    revisionNotes: z.string().trim().max(SCRIPT_REVISION_LIMITS.NOTES_MAX),
    quickFixes: z.array(z.string()).min(0),
  })
  .superRefine((data, ctx) => {
    if (!data.revisionNotes && data.quickFixes.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["revisionNotes"],
        message: SCRIPT_REVISION_COPY.feedbackRequired,
      });
    }
  });

export function ScriptRevisionPanel({
  entryId,
  currentScript,
  onApplyRevision,
}: Props): JSX.Element {
  const createRevision = useCreateScriptRevision();
  const [revisionNotes, setRevisionNotes] = useState("");
  const [selectedFixes, setSelectedFixes] = useState<ScriptRevisionQuickFix[]>(
    [],
  );
  const [preview, setPreview] = useState<ScriptRevision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [appliedFlash, setAppliedFlash] = useState(false);

  const baseScript = preview?.revisedScript ?? currentScript;
  const validationError = useMemo(() => {
    const parsed = revisionInputSchema.safeParse({
      currentScript: baseScript,
      revisionNotes,
      quickFixes: selectedFixes,
    });
    if (parsed.success) return null;
    return parsed.error.issues[0]?.message ?? SCRIPT_REVISION_COPY.genericError;
  }, [baseScript, revisionNotes, selectedFixes]);

  const toggleFix = (fix: ScriptRevisionQuickFix): void => {
    setSelectedFixes((current) =>
      current.includes(fix)
        ? current.filter((item) => item !== fix)
        : [...current, fix],
    );
  };

  const regenerate = async (): Promise<void> => {
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      const revision = await createRevision.mutateAsync({
        entryId,
        currentScript: baseScript,
        revisionNotes: revisionNotes.trim() || null,
        quickFixes: selectedFixes,
      });
      setPreview(revision);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : SCRIPT_REVISION_COPY.genericError;
      setError(message);
      logger.error("script revision failed", { entryId, err: String(err) });
    }
  };

  const applyRevision = async (): Promise<void> => {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      await onApplyRevision(preview.revisedScript);
      setPreview(null);
      setAppliedFlash(true);
      window.setTimeout(() => setAppliedFlash(false), 1500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : SCRIPT_REVISION_COPY.genericError;
      setError(message);
      logger.error("script revision apply failed", { entryId, err: String(err) });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-md border border-line bg-cream-2/40 p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
            <Sparkles size={13} className="text-yellow-bg-deep" />
            {SCRIPT_REVISION_COPY.title}
          </div>
          <p className="text-[11.5px] text-ink-3 mt-0.5">
            {SCRIPT_REVISION_COPY.description}
          </p>
        </div>
        {appliedFlash && (
          <span className="flex items-center gap-1 text-[11px] text-sage-deep font-semibold">
            <Check size={11} />
            {SCRIPT_REVISION_COPY.appliedMessage}
          </span>
        )}
      </div>

      <label className="block">
        <span className="field-label">{SCRIPT_REVISION_COPY.notesLabel}</span>
        <textarea
          value={revisionNotes}
          onChange={(event) => setRevisionNotes(event.target.value)}
          rows={3}
          maxLength={SCRIPT_REVISION_LIMITS.NOTES_MAX}
          placeholder={SCRIPT_REVISION_COPY.notesPlaceholder}
          className="form-textarea text-[13px]"
        />
      </label>

      <div>
        <div className="field-label">{SCRIPT_REVISION_COPY.quickFixLabel}</div>
        <div className="flex flex-wrap gap-1.5">
          {SCRIPT_REVISION_QUICK_FIXES.map((fix) => {
            const selected = selectedFixes.includes(fix.id);
            return (
              <button
                key={fix.id}
                type="button"
                onClick={() => toggleFix(fix.id)}
                className={`tab !px-2.5 !py-1 !text-[11px] ${
                  selected ? "tab-active" : "bg-paper text-ink-2"
                }`}
                aria-pressed={selected}
              >
                {fix.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void regenerate()}
          disabled={createRevision.isPending || Boolean(validationError)}
          className="btn btn-primary text-[12px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCcw
            size={13}
            className={createRevision.isPending ? "animate-spin" : ""}
          />
          {createRevision.isPending
            ? SCRIPT_REVISION_COPY.generatingButton
            : preview
              ? SCRIPT_REVISION_COPY.regenerateAgainButton
              : SCRIPT_REVISION_COPY.regenerateButton}
        </button>
        {validationError && (
          <span className="text-[11.5px] text-ink-3">{validationError}</span>
        )}
      </div>

      {error && (
        <div className="text-[11.5px] text-rose-deep bg-rose/30 border border-rose-deep/30 rounded-md px-2.5 py-1.5">
          {error}
        </div>
      )}

      {preview && (
        <div className="rounded-md border border-ink-3/30 bg-paper p-3 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-[13px] font-semibold text-ink">
                {SCRIPT_REVISION_COPY.previewTitle}
              </h4>
              <p className="text-[11.5px] text-ink-3">
                {SCRIPT_REVISION_COPY.previewHelp}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="iconbtn"
              aria-label={SCRIPT_REVISION_COPY.cancelButton}
              title={SCRIPT_REVISION_COPY.cancelButton}
            >
              <X size={13} />
            </button>
          </div>
          <div className="rounded-md border border-line bg-paper p-2.5">
            <RenderedMarkdown text={preview.revisedScript} />
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="btn btn-ghost text-[12px]"
            >
              {SCRIPT_REVISION_COPY.cancelButton}
            </button>
            <button
              type="button"
              onClick={() => void applyRevision()}
              disabled={applying}
              className="btn btn-primary text-[12px] disabled:opacity-60 disabled:cursor-wait"
            >
              <Check size={13} />
              {applying
                ? SCRIPT_REVISION_COPY.applyingButton
                : SCRIPT_REVISION_COPY.applyButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

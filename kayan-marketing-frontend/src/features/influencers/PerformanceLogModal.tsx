import { useEffect, useState } from "react";
import { X, BarChart3, Loader2, Check } from "lucide-react";
import { useCreateInfluencerPerformanceLog } from "./hooks/use-influencer-submissions";
import type {
  InfluencerPlatform,
} from "../../constants/influencer-submissions";
import { logger } from "../../utils/logger";

// Modal for logging per-platform performance metrics on a verified
// submission. The admin is invited to fill out views/likes/comments/
// shares/reach for each platform the influencer actually posted on
// (i.e. only platforms with a non-null `*_post_url` on the submission).
//
// Save fires one POST per platform. Already-logged platforms are not
// re-created — the admin edits those in a future iteration if needed.
// For V1 we only support initial logging from this modal.

const PLATFORM_LABEL: Record<InfluencerPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
};

interface SubmissionContext {
  id: string;
  influencerId: string;
  influencerName: string;
  entryTitle: string;
  tiktokPostUrl: string | null;
  instagramPostUrl: string | null;
  snapchatPostUrl: string | null;
  // Pre-existing logs the admin's already saved for this submission.
  // Used to filter out platforms that already have a log so we don't
  // create duplicates.
  loggedPlatforms: ReadonlySet<InfluencerPlatform>;
}

interface PlatformInputs {
  views: string;
  likes: string;
  comments: string;
  shares: string;
  reach: string;
  notes: string;
}

const EMPTY_INPUTS: PlatformInputs = {
  views: "",
  likes: "",
  comments: "",
  shares: "",
  reach: "",
  notes: "",
};

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  submission: SubmissionContext | null;
}

export function PerformanceLogModal({
  isOpen,
  onClose,
  submission,
}: Props): JSX.Element | null {
  const createLog = useCreateInfluencerPerformanceLog();
  const [inputs, setInputs] = useState<Record<InfluencerPlatform, PlatformInputs>>({
    tiktok: EMPTY_INPUTS,
    instagram: EMPTY_INPUTS,
    snapchat: EMPTY_INPUTS,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Reset state every time the modal reopens for a different submission.
  useEffect(() => {
    if (!isOpen) return;
    setInputs({
      tiktok: EMPTY_INPUTS,
      instagram: EMPTY_INPUTS,
      snapchat: EMPTY_INPUTS,
    });
    setErrorMessage(null);
    setSavedFlash(false);
  }, [isOpen, submission?.id]);

  if (!isOpen || !submission) return null;

  // Platforms that have a post URL — the only ones we offer inputs for.
  // If the admin already logged one, it's hidden so we don't duplicate.
  const visiblePlatforms: InfluencerPlatform[] = (
    ["tiktok", "instagram", "snapchat"] as const
  ).filter((p) => {
    const url =
      p === "tiktok"
        ? submission.tiktokPostUrl
        : p === "instagram"
          ? submission.instagramPostUrl
          : submission.snapchatPostUrl;
    return Boolean(url) && !submission.loggedPlatforms.has(p);
  });

  const setField = (
    platform: InfluencerPlatform,
    field: keyof PlatformInputs,
    value: string,
  ): void => {
    setInputs((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  };

  const onSave = async (): Promise<void> => {
    setErrorMessage(null);

    // Collect platforms with at least one numeric value entered.
    const toCreate: Array<{
      platform: InfluencerPlatform;
      values: PlatformInputs;
    }> = [];
    for (const p of visiblePlatforms) {
      const v = inputs[p];
      const hasValue =
        v.views.trim() ||
        v.likes.trim() ||
        v.comments.trim() ||
        v.shares.trim() ||
        v.reach.trim() ||
        v.notes.trim();
      if (hasValue) toCreate.push({ platform: p, values: v });
    }

    if (toCreate.length === 0) {
      setErrorMessage("Add at least one metric for one platform.");
      return;
    }

    try {
      for (const { platform, values } of toCreate) {
        await createLog.mutateAsync({
          submissionId: submission.id,
          platform,
          views: parseOptionalInt(values.views),
          likes: parseOptionalInt(values.likes),
          comments: parseOptionalInt(values.comments),
          shares: parseOptionalInt(values.shares),
          reach: parseOptionalInt(values.reach),
          notes: values.notes.trim() ? values.notes.trim() : null,
        });
      }
      setSavedFlash(true);
      window.setTimeout(() => {
        setSavedFlash(false);
        onClose();
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      setErrorMessage(message);
      logger.error("performance log save failed", { err: String(err) });
    }
  };

  const allAlreadyLogged = visiblePlatforms.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-paper rounded-lg shadow-lg text-ink max-h-[90vh] overflow-y-auto canvas-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line sticky top-0 bg-paper z-10">
          <div className="min-w-0">
            <h2 className="font-serif text-[19px] tracking-tight text-ink">
              Log performance
            </h2>
            <p className="text-[12px] text-ink-3 mt-0.5 truncate">
              {submission.influencerName} · {submission.entryTitle}
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

        <div className="px-5 py-5 space-y-5">
          {allAlreadyLogged ? (
            <div className="text-[13px] text-ink-3 italic">
              All platforms on this submission already have a performance
              log. No new metrics to capture.
            </div>
          ) : (
            visiblePlatforms.map((p) => (
              <section key={p} className="space-y-2">
                <h3 className="h-card-sm flex items-center gap-1.5">
                  <BarChart3 size={13} className="text-ink-3" />
                  {PLATFORM_LABEL[p]}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <MetricInput
                    label="Views"
                    value={inputs[p].views}
                    onChange={(v) => setField(p, "views", v)}
                  />
                  <MetricInput
                    label="Likes"
                    value={inputs[p].likes}
                    onChange={(v) => setField(p, "likes", v)}
                  />
                  <MetricInput
                    label="Comments"
                    value={inputs[p].comments}
                    onChange={(v) => setField(p, "comments", v)}
                  />
                  <MetricInput
                    label="Shares"
                    value={inputs[p].shares}
                    onChange={(v) => setField(p, "shares", v)}
                  />
                  <MetricInput
                    label="Reach"
                    value={inputs[p].reach}
                    onChange={(v) => setField(p, "reach", v)}
                  />
                </div>
                <div>
                  <label className="field-label">Notes (optional)</label>
                  <input
                    type="text"
                    value={inputs[p].notes}
                    onChange={(e) => setField(p, "notes", e.target.value)}
                    placeholder="Anything contextual about these numbers"
                    className="form-input"
                  />
                </div>
              </section>
            ))
          )}

          {errorMessage && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-3 py-2 text-[12.5px]">
              {errorMessage}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-line">
          {savedFlash && (
            <span className="flex items-center gap-1 text-[12.5px] text-sage-deep mr-auto">
              <Check size={13} /> Saved
            </span>
          )}
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={createLog.isPending || allAlreadyLogged}
            className="btn btn-primary disabled:opacity-50"
          >
            {createLog.isPending ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save metrics"
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

function MetricInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  return (
    <div>
      <label className="field-label !mb-1">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-input"
        inputMode="numeric"
      />
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Check,
  ExternalLink,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  X,
} from "lucide-react";
import { format } from "date-fns";
import {
  INFLUENCER_SUBMISSION_STATUS,
  INFLUENCER_SUBMISSION_STATUS_LABELS,
  INFLUENCER_PLATFORM_LABELS,
  type InfluencerPlatform,
  type InfluencerSubmissionStatus,
} from "../constants/influencer-submissions";
import { ROUTES } from "../constants/routes";
import {
  useInfluencerSubmissions,
  useUpdateInfluencerSubmission,
} from "../features/influencers/hooks/use-influencer-submissions";
import { PerformanceLogModal } from "../features/influencers/PerformanceLogModal";
import type { InfluencerSubmissionListItem } from "../types/influencer-submission";
import { logger } from "../utils/logger";

// Filter chip: any submission status, plus "all" meaning no filter.
type StatusFilter = InfluencerSubmissionStatus | "all";

const STATUS_CHIP: Record<InfluencerSubmissionStatus, string> = {
  pending: "bg-yellow text-obsidian",
  verified: "bg-sage text-[#2C5530]",
  disputed: "bg-rose text-[#6E2A35]",
};

const FILTER_CHIPS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: INFLUENCER_SUBMISSION_STATUS.PENDING, label: "Pending" },
  { key: INFLUENCER_SUBMISSION_STATUS.DISPUTED, label: "Disputed" },
  { key: INFLUENCER_SUBMISSION_STATUS.VERIFIED, label: "Verified" },
  { key: "all", label: "All" },
];

// Pull the platforms an influencer actually posted on for a submission.
// Used both in the table (icons row) and to drive the perf-log modal's
// per-platform inputs.
function platformsOnSubmission(
  s: InfluencerSubmissionListItem,
): InfluencerPlatform[] {
  const out: InfluencerPlatform[] = [];
  if (s.tiktokPostUrl) out.push("tiktok");
  if (s.instagramPostUrl) out.push("instagram");
  if (s.snapchatPostUrl) out.push("snapchat");
  return out;
}

export default function PendingVerificationsPage(): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  // The list query: backend supports filtering by `status` — when "all"
  // is picked we drop the param so the endpoint returns every row.
  const list = useInfluencerSubmissions(
    statusFilter === "all" ? {} : { status: statusFilter },
  );
  const update = useUpdateInfluencerSubmission();

  const [viewing, setViewing] = useState<InfluencerSubmissionListItem | null>(null);
  const [verifying, setVerifying] = useState<InfluencerSubmissionListItem | null>(null);
  const [disputing, setDisputing] = useState<InfluencerSubmissionListItem | null>(null);
  const [logging, setLogging] = useState<InfluencerSubmissionListItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = useMemo(() => list.data ?? [], [list.data]);

  const verify = async (
    submission: InfluencerSubmissionListItem,
  ): Promise<void> => {
    setActionError(null);
    try {
      await update.mutateAsync({
        id: submission.id,
        input: { verificationStatus: INFLUENCER_SUBMISSION_STATUS.VERIFIED },
      });
      setVerifying(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verify failed.";
      setActionError(message);
      logger.error("verify submission failed", { err: String(err) });
    }
  };

  const dispute = async (
    submission: InfluencerSubmissionListItem,
    reason: string,
  ): Promise<void> => {
    setActionError(null);
    try {
      await update.mutateAsync({
        id: submission.id,
        input: {
          verificationStatus: INFLUENCER_SUBMISSION_STATUS.DISPUTED,
          disputeReason: reason,
        },
      });
      setDisputing(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dispute failed.";
      setActionError(message);
      logger.error("dispute submission failed", { err: String(err) });
    }
  };

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5 md:mb-6">
        <div>
          <Link
            to={ROUTES.INFLUENCERS}
            className="text-[12px] text-ink-3 hover:text-ink inline-flex items-center gap-1 mb-1.5"
          >
            <ArrowLeft size={12} />
            Influencers
          </Link>
          <h1 className="h-greeting text-[24px] md:text-[30px]">
            Pending <em>verifications</em>
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
            Review creator-submitted post links, verify or dispute, and log
            performance once the post has had time to run.
          </p>
        </div>
      </header>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-5 md:mb-6">
        {FILTER_CHIPS.map((c) => {
          const isActive = statusFilter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setStatusFilter(c.key)}
              className={`chip ${
                isActive ? "bg-obsidian text-yellow" : "chip-default hover:brightness-95"
              }`}
              aria-pressed={isActive}
            >
              {c.label}
            </button>
          );
        })}
        <span className="ml-auto text-[12px] text-ink-3">
          {list.isLoading
            ? "Loading…"
            : `${rows.length} submission${rows.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {actionError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-3 mb-4 text-[13px] flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {list.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 mb-4 text-[13px]">
          {list.error instanceof Error
            ? list.error.message
            : "Failed to load submissions."}
        </div>
      )}

      {list.isLoading && (
        <p className="text-ink-3 text-[13px] py-4">Loading submissions…</p>
      )}

      {!list.isLoading && rows.length === 0 && (
        <div className="card text-center py-14">
          <ShieldCheck size={28} className="mx-auto text-ink-3 mb-3" />
          <h3 className="font-serif text-[16px] text-ink mb-1.5">
            No {statusFilter === "all" ? "" : `${statusFilter} `}submissions
          </h3>
          <p className="text-[13px] text-ink-3 max-w-md mx-auto">
            Creators submit posts from their portal. Anything that lands here
            is awaiting your review.
          </p>
        </div>
      )}

      {!list.isLoading && rows.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                <tr>
                  <th className="py-2 pr-3">Influencer</th>
                  <th className="py-2 pr-3">Collab</th>
                  <th className="py-2 pr-3">Submitted</th>
                  <th className="py-2 pr-3">Platforms</th>
                  <th className="py-2 pr-3">Tagged</th>
                  <th className="py-2 pr-3">Promo</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <SubmissionTableRow
                    key={row.id}
                    submission={row}
                    onView={() => setViewing(row)}
                    onVerify={() => setVerifying(row)}
                    onDispute={() => setDisputing(row)}
                    onLog={() => setLogging(row)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <SubmissionMobileCard
                key={row.id}
                submission={row}
                onView={() => setViewing(row)}
                onVerify={() => setVerifying(row)}
                onDispute={() => setDisputing(row)}
                onLog={() => setLogging(row)}
              />
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <ViewSubmissionModal
        submission={viewing}
        onClose={() => setViewing(null)}
      />
      <VerifyModal
        submission={verifying}
        onClose={() => setVerifying(null)}
        onConfirm={verify}
        isPending={update.isPending}
      />
      <DisputeModal
        submission={disputing}
        onClose={() => setDisputing(null)}
        onConfirm={dispute}
        isPending={update.isPending}
      />
      <PerformanceLogModal
        isOpen={logging !== null}
        onClose={() => setLogging(null)}
        submission={
          logging
            ? {
                id: logging.id,
                influencerId: logging.influencerId,
                influencerName: logging.influencer?.displayName ?? "Influencer",
                entryTitle: logging.entry?.title ?? "Collaboration",
                tiktokPostUrl: logging.tiktokPostUrl,
                instagramPostUrl: logging.instagramPostUrl,
                snapchatPostUrl: logging.snapchatPostUrl,
                loggedPlatforms: new Set(
                  (logging.performanceLogs ?? []).map((l) => l.platform),
                ),
              }
            : null
        }
      />
    </div>
  );
}

// ─── Table rows ──────────────────────────────────────────────────────────

interface RowActions {
  onView: () => void;
  onVerify: () => void;
  onDispute: () => void;
  onLog: () => void;
}

function SubmissionTableRow({
  submission,
  onView,
  onVerify,
  onDispute,
  onLog,
}: { submission: InfluencerSubmissionListItem } & RowActions): JSX.Element {
  const platforms = platformsOnSubmission(submission);
  const isPending = submission.verificationStatus === "pending";
  const isVerified = submission.verificationStatus === "verified";
  const hasLogs = (submission.performanceLogs?.length ?? 0) > 0;

  return (
    <tr className="border-b border-line/60 hover:bg-cream-2/40">
      <td className="py-2.5 pr-3 text-ink">
        {submission.influencer ? (
          <Link
            to={ROUTES.INFLUENCER_DETAIL(submission.influencer.id)}
            className="hover:underline"
          >
            {submission.influencer.displayName}
          </Link>
        ) : (
          <span className="text-ink-3 italic">Unknown</span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-ink-2 max-w-[260px] truncate">
        {submission.entry?.title ?? <span className="italic">Removed</span>}
      </td>
      <td className="py-2.5 pr-3 text-ink-3 whitespace-nowrap">
        {format(new Date(submission.submittedAt), "MMM d")}
      </td>
      <td className="py-2.5 pr-3">
        <PlatformIconRow platforms={platforms} />
      </td>
      <td className="py-2.5 pr-3">
        <YesNoBadge value={submission.taggedKayan} />
      </td>
      <td className="py-2.5 pr-3">
        <YesNoBadge value={submission.usedPromoCode} />
      </td>
      <td className="py-2.5 pr-3">
        <span
          className={`chip ${STATUS_CHIP[submission.verificationStatus]} font-semibold`}
        >
          {INFLUENCER_SUBMISSION_STATUS_LABELS[submission.verificationStatus]}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={onView} className="btn btn-ghost !text-[12px] !px-2 !py-1">
            View
          </button>
          {isPending && (
            <>
              <button
                onClick={onVerify}
                className="btn btn-primary !text-[12px] !px-2.5 !py-1"
              >
                <ShieldCheck size={11} />
                Verify
              </button>
              <button
                onClick={onDispute}
                className="btn btn-ghost !text-[12px] !px-2 !py-1 text-rose-deep"
              >
                <ShieldAlert size={11} />
                Dispute
              </button>
            </>
          )}
          {isVerified && (
            <button
              onClick={onLog}
              className="btn btn-ghost !text-[12px] !px-2 !py-1"
              title={hasLogs ? "Add more performance logs" : "Log post performance"}
            >
              <BarChart3 size={11} />
              {hasLogs ? "Log more" : "Log perf"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function SubmissionMobileCard({
  submission,
  onView,
  onVerify,
  onDispute,
  onLog,
}: { submission: InfluencerSubmissionListItem } & RowActions): JSX.Element {
  const platforms = platformsOnSubmission(submission);
  const isPending = submission.verificationStatus === "pending";
  const isVerified = submission.verificationStatus === "verified";

  return (
    <article className="card space-y-2">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-serif text-[15px] text-ink leading-tight truncate">
            {submission.influencer?.displayName ?? "Unknown"}
          </h3>
          <p className="text-[12.5px] text-ink-2 truncate">
            {submission.entry?.title ?? "—"}
          </p>
        </div>
        <span
          className={`chip ${STATUS_CHIP[submission.verificationStatus]} font-semibold flex-shrink-0`}
        >
          {INFLUENCER_SUBMISSION_STATUS_LABELS[submission.verificationStatus]}
        </span>
      </header>
      <div className="flex items-center gap-3 text-[12px] text-ink-3 flex-wrap">
        <span>{format(new Date(submission.submittedAt), "MMM d")}</span>
        <PlatformIconRow platforms={platforms} />
        <span>
          Tagged: <YesNoBadge value={submission.taggedKayan} compact />
        </span>
        <span>
          Promo: <YesNoBadge value={submission.usedPromoCode} compact />
        </span>
      </div>
      <div className="flex items-center gap-1.5 pt-1.5 border-t border-line">
        <button onClick={onView} className="btn btn-ghost !text-[12px] !px-2 !py-1">
          View
        </button>
        {isPending && (
          <>
            <button
              onClick={onVerify}
              className="btn btn-primary !text-[12px] !px-2.5 !py-1"
            >
              <ShieldCheck size={11} /> Verify
            </button>
            <button
              onClick={onDispute}
              className="btn btn-ghost !text-[12px] !px-2 !py-1 text-rose-deep"
            >
              <ShieldAlert size={11} /> Dispute
            </button>
          </>
        )}
        {isVerified && (
          <button
            onClick={onLog}
            className="btn btn-ghost !text-[12px] !px-2 !py-1"
          >
            <BarChart3 size={11} /> Log perf
          </button>
        )}
      </div>
    </article>
  );
}

function PlatformIconRow({
  platforms,
}: {
  platforms: ReadonlyArray<InfluencerPlatform>;
}): JSX.Element {
  if (platforms.length === 0) {
    return <span className="text-ink-3 italic text-[11.5px]">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      {platforms.map((p) => (
        <span
          key={p}
          className="chip chip-default text-[10.5px] !px-1.5 !py-0.5"
          title={INFLUENCER_PLATFORM_LABELS[p]}
        >
          {INFLUENCER_PLATFORM_LABELS[p]}
        </span>
      ))}
    </span>
  );
}

function YesNoBadge({
  value,
  compact = false,
}: {
  value: boolean | null;
  compact?: boolean;
}): JSX.Element {
  if (value === null) {
    return <span className="text-ink-3 italic text-[11.5px]">—</span>;
  }
  const label = value ? "Yes" : "No";
  const className = value
    ? "bg-sage text-[#2C5530]"
    : "bg-cream-2 text-ink-2";
  return (
    <span
      className={`chip ${className} ${compact ? "!px-1.5 !py-0 !text-[10.5px]" : ""}`}
    >
      {label}
    </span>
  );
}

// ─── Modals ──────────────────────────────────────────────────────────────

function ViewSubmissionModal({
  submission,
  onClose,
}: {
  submission: InfluencerSubmissionListItem | null;
  onClose: () => void;
}): JSX.Element | null {
  if (!submission) return null;
  const urls: Array<{ platform: InfluencerPlatform; url: string }> = [];
  if (submission.tiktokPostUrl)
    urls.push({ platform: "tiktok", url: submission.tiktokPostUrl });
  if (submission.instagramPostUrl)
    urls.push({ platform: "instagram", url: submission.instagramPostUrl });
  if (submission.snapchatPostUrl)
    urls.push({ platform: "snapchat", url: submission.snapchatPostUrl });

  return (
    <ModalShell title={`Submission: ${submission.influencer?.displayName ?? "—"}`} onClose={onClose}>
      <div className="space-y-4 text-[13px]">
        <div>
          <div className="eyebrow mb-1">Collab</div>
          <div className="text-ink">{submission.entry?.title ?? "—"}</div>
          {submission.entry?.targetDate && (
            <div className="text-ink-3 text-[12px] mt-0.5">
              Target date: {format(new Date(submission.entry.targetDate), "MMM d, yyyy")}
            </div>
          )}
        </div>
        <div>
          <div className="eyebrow mb-1">Submitted post URLs</div>
          <ul className="space-y-1.5">
            {urls.map((u) => (
              <li key={u.platform} className="flex items-center gap-2">
                <span className="chip chip-default !text-[10.5px]">
                  {INFLUENCER_PLATFORM_LABELS[u.platform]}
                </span>
                <a
                  href={u.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink hover:underline inline-flex items-center gap-1 truncate"
                >
                  <span className="truncate max-w-[360px]">{u.url}</span>
                  <ExternalLink size={11} className="flex-shrink-0 text-ink-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="eyebrow mb-1">Tagged Kayan</div>
            <YesNoBadge value={submission.taggedKayan} />
          </div>
          <div>
            <div className="eyebrow mb-1">Used promo</div>
            <YesNoBadge value={submission.usedPromoCode} />
          </div>
        </div>
        {submission.notes && (
          <div>
            <div className="eyebrow mb-1">Creator notes</div>
            <p className="text-ink-2 leading-relaxed whitespace-pre-line">
              {submission.notes}
            </p>
          </div>
        )}
        {submission.disputeReason && (
          <div className="rounded-md bg-rose/40 border border-rose-deep/30 px-3 py-2 text-[#6E2A35]">
            <div className="eyebrow mb-1">Dispute reason</div>
            <p className="leading-relaxed whitespace-pre-line">
              {submission.disputeReason}
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function VerifyModal({
  submission,
  onClose,
  onConfirm,
  isPending,
}: {
  submission: InfluencerSubmissionListItem | null;
  onClose: () => void;
  onConfirm: (s: InfluencerSubmissionListItem) => void;
  isPending: boolean;
}): JSX.Element | null {
  if (!submission) return null;
  return (
    <ModalShell title="Verify submission" onClose={onClose} maxWidth="max-w-md">
      <p className="text-[13px] text-ink-2 leading-relaxed">
        Mark this submission as verified? This will create a follow-up task
        to log post performance in 5 days.
      </p>
      <div className="rounded-md bg-cream-2/60 border border-line p-3 my-3 text-[12.5px] text-ink-2">
        <strong className="text-ink">
          {submission.influencer?.displayName ?? "—"}
        </strong>{" "}
        · {submission.entry?.title ?? "—"}
      </div>
      <footer className="flex items-center justify-end gap-2 pt-2 border-t border-line">
        <button onClick={onClose} className="btn btn-ghost">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(submission)}
          disabled={isPending}
          className="btn btn-primary disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              <Check size={13} />
              Verify
            </>
          )}
        </button>
      </footer>
    </ModalShell>
  );
}

function DisputeModal({
  submission,
  onClose,
  onConfirm,
  isPending,
}: {
  submission: InfluencerSubmissionListItem | null;
  onClose: () => void;
  onConfirm: (s: InfluencerSubmissionListItem, reason: string) => void;
  isPending: boolean;
}): JSX.Element | null {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (!submission) return null;

  const submit = (): void => {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setReasonError("Add a dispute reason (≥ 5 characters).");
      return;
    }
    setReasonError(null);
    onConfirm(submission, trimmed);
  };

  return (
    <ModalShell title="Dispute submission" onClose={onClose} maxWidth="max-w-md">
      <p className="text-[13px] text-ink-2 leading-relaxed">
        Tell the creator what's off. Your reason is stored on the submission
        and visible to the team.
      </p>
      <div className="rounded-md bg-cream-2/60 border border-line p-3 my-3 text-[12.5px] text-ink-2">
        <strong className="text-ink">
          {submission.influencer?.displayName ?? "—"}
        </strong>{" "}
        · {submission.entry?.title ?? "—"}
      </div>
      <label className="field-label">Dispute reason</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g., URL doesn't go to the posted video / Kayan tag missing / video was deleted."
        rows={3}
        className="form-textarea"
      />
      {reasonError && (
        <p className="text-rose-deep text-[12px] mt-1.5">{reasonError}</p>
      )}
      <footer className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-line">
        <button onClick={onClose} className="btn btn-ghost">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="btn btn-primary disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <ShieldAlert size={13} />
              Submit dispute
            </>
          )}
        </button>
      </footer>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-xl",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-paper rounded-lg shadow-lg text-ink max-h-[90vh] overflow-y-auto canvas-scroll`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line sticky top-0 bg-paper z-10">
          <h2 className="font-serif text-[18px] tracking-tight text-ink">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

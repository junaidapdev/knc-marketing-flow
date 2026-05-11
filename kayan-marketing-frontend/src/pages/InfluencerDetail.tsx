import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Pencil,
  Play,
  RotateCw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ROUTES } from "../constants/routes";
import { INFLUENCER_LANGUAGE_LABELS } from "../constants/influencer-languages";
import { INFLUENCER_NICHE_TAG_LABELS } from "../constants/influencer-niche-tags";
import {
  INFLUENCER_STATUS,
  INFLUENCER_STATUS_LABELS,
  type InfluencerStatus,
} from "../constants/influencer-status";
import {
  INFLUENCER_SUBMISSION_STATUS_LABELS,
  type InfluencerSubmissionStatus,
} from "../constants/influencer-submissions";
import { ENTRY_TYPES } from "../constants/entry-types";
import { InfluencerFormModal } from "../features/influencers/InfluencerFormModal";
import {
  useDeleteInfluencer,
  useInfluencer,
  useRotateInfluencerToken,
  useUpdateInfluencerStatus,
} from "../features/influencers/hooks/use-influencers";
import { useInfluencerSubmissions } from "../features/influencers/hooks/use-influencer-submissions";
import { useCalendarEntries } from "../features/calendar/hooks/use-calendar-entries";
import type { CalendarEntry } from "../types/calendar-entry";
import type { InfluencerSubmissionListItem } from "../types/influencer-submission";
import type {
  InfluencerReliability,
  InfluencerWithReliability,
} from "../types/influencer";
import { logger } from "../utils/logger";

const RELIABILITY_MIN_COLLABS = 3;

const EMPTY_VALUE = "Not set";

function statusChipClass(status: InfluencerStatus): string {
  switch (status) {
    case INFLUENCER_STATUS.ACTIVE:
      return "status-active";
    case INFLUENCER_STATUS.PAUSED:
      return "status-planned";
    case INFLUENCER_STATUS.BLACKLISTED:
      return "status-overdue";
    default:
      return "status-planned";
  }
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return EMPTY_VALUE;
  if (typeof value === "number") return value.toLocaleString();
  return value;
}

function formatMoney(value: number | null): string {
  if (value === null) return EMPTY_VALUE;
  return `${value.toLocaleString()} SAR`;
}

function formatDate(value: string | null): string {
  if (!value) return EMPTY_VALUE;
  return new Date(value).toLocaleString();
}

function portalUrl(token: string): string {
  return `${window.location.origin}/creator/${token}`;
}

export default function InfluencerDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useInfluencer(id ?? null);
  const remove = useDeleteInfluencer();
  const [editing, setEditing] = useState(false);

  const creatorPortalUrl = useMemo(
    () => (detail.data ? portalUrl(detail.data.portalToken) : ""),
    [detail.data],
  );

  const onDelete = async (): Promise<void> => {
    if (!detail.data) return;
    const ok = window.confirm(
      `Delete ${detail.data.displayName}? This removes the influencer record.`,
    );
    if (!ok) return;
    try {
      await remove.mutateAsync(detail.data.id);
      navigate(ROUTES.INFLUENCERS);
    } catch (err) {
      logger.error("delete influencer failed", { err: String(err) });
    }
  };

  if (!id) {
    return (
      <div className="px-4 md:px-9 pt-5 md:pt-8 text-rose-deep">
        Missing influencer id.
      </div>
    );
  }

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12">
      <button
        onClick={() => navigate(ROUTES.INFLUENCERS)}
        className="flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink mb-4"
      >
        <ChevronLeft size={14} />
        Back to Influencers
      </button>

      {detail.isLoading && (
        <p className="text-ink-3 text-[13px] py-8">Loading...</p>
      )}
      {detail.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4">
          {detail.error instanceof Error
            ? detail.error.message
            : "Failed to load influencer."}
        </div>
      )}

      {detail.data && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3 mb-5 md:mb-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="h-greeting text-[22px] md:text-[30px] break-words">
                  {detail.data.displayName}
                </h1>
                <span className={`chip ${statusChipClass(detail.data.status)}`}>
                  {INFLUENCER_STATUS_LABELS[detail.data.status]}
                </span>
              </div>
              <p className="text-[12.5px] md:text-[14px] text-ink-2">
                {detail.data.whatsapp}
                {detail.data.city ? ` · ${detail.data.city}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(true)}
                className="btn btn-ghost"
              >
                <Pencil size={14} />
                Edit
              </button>
              <button
                onClick={onDelete}
                disabled={remove.isPending}
                className="px-3 py-2 text-[13px] text-rose-deep hover:brightness-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
            <section className="space-y-4">
              <DetailSection title="Reliability">
                <ReliabilityPanel reliability={detail.data.reliability} />
              </DetailSection>

              <DetailSection title="Contact">
                <DetailGrid>
                  <DetailRow
                    label="Display name"
                    value={detail.data.displayName}
                  />
                  <DetailRow label="Full name" value={detail.data.fullName} />
                  <DetailRow label="WhatsApp" value={detail.data.whatsapp} />
                  <DetailRow label="City" value={detail.data.city} />
                </DetailGrid>
              </DetailSection>

              <DetailSection title="Platforms">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <PlatformCard
                    title="TikTok"
                    handle={detail.data.tiktokHandle}
                    url={detail.data.tiktokUrl}
                    followers={detail.data.tiktokFollowers}
                  />
                  <PlatformCard
                    title="Instagram"
                    handle={detail.data.instagramHandle}
                    url={detail.data.instagramUrl}
                    followers={detail.data.instagramFollowers}
                  />
                  <PlatformCard
                    title="Snapchat"
                    handle={detail.data.snapchatHandle}
                    url={detail.data.snapchatUrl}
                    followers={detail.data.snapchatFollowers}
                  />
                </div>
              </DetailSection>

              <DetailSection title="Commercials">
                <DetailGrid>
                  <DetailRow
                    label="Standard rate"
                    value={formatMoney(detail.data.standardRate)}
                  />
                  <DetailRow
                    label="Accepts barter"
                    value={detail.data.acceptsBarter ? "Yes" : "No"}
                  />
                </DetailGrid>
              </DetailSection>

              <DetailSection title="Content fit">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ChipBlock
                    label="Niche tags"
                    emptyLabel="No niche tags"
                    values={detail.data.nicheTags.map(
                      (tag) => INFLUENCER_NICHE_TAG_LABELS[tag],
                    )}
                  />
                  <ChipBlock
                    label="Languages"
                    emptyLabel="No languages"
                    values={detail.data.languages.map(
                      (language) => INFLUENCER_LANGUAGE_LABELS[language],
                    )}
                  />
                </div>
              </DetailSection>

              <DetailSection title="Notes">
                <p className="whitespace-pre-wrap text-[13px] text-ink-2 leading-relaxed">
                  {detail.data.notes || EMPTY_VALUE}
                </p>
              </DetailSection>
            </section>

            <aside className="space-y-4">
              <DetailSection title="Portal management">
                <PortalManagement
                  influencer={detail.data}
                  portalUrl={creatorPortalUrl}
                />
              </DetailSection>

              <DetailSection title="Activity">
                <ActivityPanel influencerId={detail.data.id} />
              </DetailSection>
            </aside>
          </div>

          <InfluencerFormModal
            isOpen={editing}
            onClose={() => setEditing(false)}
            editing={detail.data}
          />
        </>
      )}
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="card">
      <h2 className="h-card-sm mb-3">{title}</h2>
      {children}
    </section>
  );
}

function DetailGrid({ children }: { children: ReactNode }): JSX.Element {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
      {children}
    </dl>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}): JSX.Element {
  return (
    <div>
      <dt className="eyebrow mb-1">{label}</dt>
      <dd className="text-ink break-words">{formatValue(value)}</dd>
    </div>
  );
}

function PlatformCard({
  title,
  handle,
  url,
  followers,
}: {
  title: string;
  handle: string | null;
  url: string | null;
  followers: number | null;
}): JSX.Element {
  return (
    <div className="rounded-md border border-line p-3 text-[13px]">
      <div className="font-semibold text-ink mb-2">{title}</div>
      <dl className="space-y-2">
        <DetailRow label="Handle" value={handle} />
        <DetailRow label="Followers" value={followers} />
      </dl>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink hover:underline mt-3"
        >
          Open profile
          <ExternalLink size={12} />
        </a>
      ) : (
        <p className="text-[12px] text-ink-3 mt-3">{EMPTY_VALUE}</p>
      )}
    </div>
  );
}

function ChipBlock({
  label,
  values,
  emptyLabel,
}: {
  label: string;
  values: string[];
  emptyLabel: string;
}): JSX.Element {
  return (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span key={value} className="chip chip-default">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-ink-3">{emptyLabel}</p>
      )}
    </div>
  );
}

// ─── Activity panel ──────────────────────────────────────────────────────
// Fetches the influencer's collabs (calendar_entries of type
// influencer_collab linked via influencer_id) and submissions list, then
// renders a Performance summary card + a Collaborations table.

const SUBMISSION_STATUS_CHIP: Record<InfluencerSubmissionStatus, string> = {
  pending: "bg-yellow text-obsidian",
  verified: "bg-sage text-[#2C5530]",
  disputed: "bg-rose text-[#6E2A35]",
};

interface CollabRow {
  entry: CalendarEntry;
  submission: InfluencerSubmissionListItem | null;
}

function ActivityPanel({ influencerId }: { influencerId: string }): JSX.Element {
  const entries = useCalendarEntries({ influencerId });
  const submissions = useInfluencerSubmissions({ influencerId });

  // Submissions keyed by entryId — at most one submission per entry in
  // current V1, but the create flow doesn't strictly enforce uniqueness.
  // We surface the most recent submission per entry.
  const submissionByEntry = useMemo(() => {
    const map = new Map<string, InfluencerSubmissionListItem>();
    for (const s of submissions.data ?? []) {
      const existing = map.get(s.entryId);
      if (!existing || new Date(s.submittedAt) > new Date(existing.submittedAt)) {
        map.set(s.entryId, s);
      }
    }
    return map;
  }, [submissions.data]);

  const collabs: CollabRow[] = useMemo(() => {
    const rows = (entries.data ?? []).filter(
      (e) => e.type === ENTRY_TYPES.INFLUENCER_COLLAB,
    );
    return rows.map((entry) => ({
      entry,
      submission: submissionByEntry.get(entry.id) ?? null,
    }));
  }, [entries.data, submissionByEntry]);

  // Performance aggregate — sum across every performance log on every
  // verified submission. Missing fields contribute 0.
  const perf = useMemo(() => {
    let totalSubmissions = 0;
    let verifiedCount = 0;
    let views = 0;
    let likes = 0;
    let comments = 0;
    let shares = 0;
    for (const s of submissions.data ?? []) {
      totalSubmissions += 1;
      if (s.verificationStatus === "verified") verifiedCount += 1;
      for (const log of s.performanceLogs ?? []) {
        views += log.views ?? 0;
        likes += log.likes ?? 0;
        comments += log.comments ?? 0;
        shares += log.shares ?? 0;
      }
    }
    return {
      totalCollabs: collabs.length,
      totalSubmissions,
      verifiedCount,
      views,
      likes,
      comments,
      shares,
    };
  }, [submissions.data, collabs.length]);

  const isLoading = entries.isLoading || submissions.isLoading;

  return (
    <div className="space-y-4">
      <PerformanceSummaryCard perf={perf} isLoading={isLoading} />
      <CollaborationsTable
        collabs={collabs}
        isLoading={isLoading}
        isError={entries.isError || submissions.isError}
      />
    </div>
  );
}

function PerformanceSummaryCard({
  perf,
  isLoading,
}: {
  perf: {
    totalCollabs: number;
    totalSubmissions: number;
    verifiedCount: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  isLoading: boolean;
}): JSX.Element {
  const hasAnyData =
    perf.totalCollabs > 0 ||
    perf.totalSubmissions > 0 ||
    perf.views > 0 ||
    perf.likes > 0;

  if (isLoading) {
    return <p className="text-[13px] text-ink-3">Loading activity…</p>;
  }
  if (!hasAnyData) {
    return (
      <p className="text-[13px] text-ink-3 italic">
        No collabs or submissions yet. Activity will populate as deals run.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12.5px]">
      <Stat label="Collabs" value={perf.totalCollabs} />
      <Stat label="Submissions" value={perf.totalSubmissions} />
      <Stat label="Verified" value={perf.verifiedCount} />
      <Stat label="Views" value={perf.views.toLocaleString()} />
      <Stat label="Likes" value={perf.likes.toLocaleString()} />
      <Stat label="Comments" value={perf.comments.toLocaleString()} />
      <Stat label="Shares" value={perf.shares.toLocaleString()} />
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}): JSX.Element {
  return (
    <div className="rounded-md bg-cream-2/60 border border-line p-2.5">
      <div className="eyebrow mb-1">{label}</div>
      <div className="text-ink font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// ─── Reliability panel ──────────────────────────────────────────────────

function reliabilityChipClass(value: number | null): string {
  if (value === null) return "bg-cream-2 text-ink-3";
  if (value >= 80) return "bg-sage text-[#2C5530]";
  if (value >= 50) return "bg-yellow text-obsidian";
  return "bg-rose text-[#6E2A35]";
}

function formatRate(value: number | null): string {
  if (value === null) return "—";
  return `${value}%`;
}

function ReliabilityPanel({
  reliability,
}: {
  reliability: InfluencerReliability | null;
}): JSX.Element {
  // Use the same ≥3 collab gate as the portal — fewer than that and
  // even the admin score is statistically uninteresting.
  const totalCollabs = reliability?.totalCollabs ?? 0;
  if (!reliability || totalCollabs < RELIABILITY_MIN_COLLABS) {
    return (
      <div className="rounded-md border border-line bg-cream-2/30 p-3 text-[12.5px] text-ink-2">
        Reliability score appears after {RELIABILITY_MIN_COLLABS} completed
        collabs.{" "}
        <span className="text-ink-3">
          Currently: {totalCollabs} collab
          {totalCollabs === 1 ? "" : "s"}.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <ReliabilityCard
          label="Post rate"
          value={reliability.postRate}
          description="Collabs where a post was submitted"
        />
        <ReliabilityCard
          label="Tag rate"
          value={reliability.tagRate}
          description="Submissions that tagged Kayan"
        />
        <ReliabilityCard
          label="On-time rate"
          value={reliability.onTimeRate}
          description="Submitted within target +1 day"
        />
      </div>
      <p className="text-[11.5px] text-ink-3">
        {totalCollabs} collab{totalCollabs === 1 ? "" : "s"} ·{" "}
        {reliability.totalSubmissions} submission
        {reliability.totalSubmissions === 1 ? "" : "s"} · scored{" "}
        {format(new Date(reliability.computedAt), "MMM d, yyyy")}
      </p>
    </div>
  );
}

function ReliabilityCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number | null;
  description: string;
}): JSX.Element {
  return (
    <div className="rounded-md border border-line p-3 bg-paper">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="eyebrow">{label}</span>
        <span
          className={`chip ${reliabilityChipClass(value)} font-semibold !text-[11px]`}
        >
          {formatRate(value)}
        </span>
      </div>
      <p className="text-[11.5px] text-ink-3 leading-snug">{description}</p>
    </div>
  );
}

// ─── Portal management panel ────────────────────────────────────────────

function statusBadgeClass(status: InfluencerStatus): string {
  switch (status) {
    case INFLUENCER_STATUS.ACTIVE:
      return "bg-sage text-[#2C5530]";
    case INFLUENCER_STATUS.PAUSED:
      return "bg-yellow text-obsidian";
    case INFLUENCER_STATUS.BLACKLISTED:
      return "bg-rose text-[#6E2A35]";
    default:
      return "bg-cream-2 text-ink-2";
  }
}

function PortalManagement({
  influencer,
  portalUrl,
}: {
  influencer: InfluencerWithReliability;
  portalUrl: string;
}): JSX.Element {
  const rotate = useRotateInfluencerToken();
  const setStatus = useUpdateInfluencerStatus();

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [confirmingBlacklist, setConfirmingBlacklist] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const status = influencer.status;
  const whatsappMessage = useMemo(
    () =>
      `Hi ${influencer.displayName}, here's your updated Kayan portal link: ${portalUrl} — save this one and use it from now on. The old link no longer works.`,
    [influencer.displayName, portalUrl],
  );

  const copy = async (kind: "url" | "message", value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      if (kind === "url") {
        setCopiedUrl(true);
        window.setTimeout(() => setCopiedUrl(false), 1500);
      } else {
        setCopiedMessage(true);
        window.setTimeout(() => setCopiedMessage(false), 1500);
      }
    } catch (err) {
      logger.warn("clipboard write failed", { err: String(err) });
    }
  };

  const handleRotate = async (): Promise<void> => {
    setActionError(null);
    try {
      await rotate.mutateAsync(influencer.id);
      setConfirmingRotate(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rotation failed.";
      setActionError(message);
    }
  };

  const handleSetStatus = async (next: InfluencerStatus): Promise<void> => {
    setActionError(null);
    try {
      await setStatus.mutateAsync({ id: influencer.id, status: next });
      if (next === INFLUENCER_STATUS.BLACKLISTED) {
        setConfirmingBlacklist(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Status change failed.";
      setActionError(message);
    }
  };

  return (
    <div className="space-y-3 text-[13px]">
      <div className="flex items-center gap-2">
        <span className="eyebrow">Status</span>
        <span
          className={`chip ${statusBadgeClass(status)} font-semibold`}
        >
          {INFLUENCER_STATUS_LABELS[status]}
        </span>
      </div>

      <div>
        <div className="eyebrow mb-1">Current portal URL</div>
        <div className="flex items-center gap-1.5 rounded-md border border-line bg-cream-2/40 px-2 py-1.5">
          <span className="font-mono text-[11.5px] text-ink-2 truncate flex-1">
            {portalUrl}
          </span>
          <button
            type="button"
            onClick={() => copy("url", portalUrl)}
            className="iconbtn !w-7 !h-7"
            title="Copy portal URL"
            aria-label="Copy portal URL"
          >
            {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
          </button>
          <a
            href={portalUrl}
            target="_blank"
            rel="noreferrer"
            className="iconbtn !w-7 !h-7"
            title="Open portal in new tab"
            aria-label="Open portal in new tab"
          >
            <ExternalLink size={12} />
          </a>
        </div>
        <p className="text-[11px] text-ink-3 mt-1">
          Activated {formatDate(influencer.portalActivatedAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        <button
          type="button"
          onClick={() => setConfirmingRotate(true)}
          disabled={rotate.isPending}
          className="btn btn-ghost disabled:opacity-50"
        >
          <RotateCw size={13} />
          Rotate portal link
        </button>
        {status === INFLUENCER_STATUS.ACTIVE && (
          <button
            type="button"
            onClick={() => handleSetStatus(INFLUENCER_STATUS.PAUSED)}
            disabled={setStatus.isPending}
            className="btn btn-ghost disabled:opacity-50"
          >
            <Pause size={13} />
            Pause creator
          </button>
        )}
        {status === INFLUENCER_STATUS.PAUSED && (
          <button
            type="button"
            onClick={() => handleSetStatus(INFLUENCER_STATUS.ACTIVE)}
            disabled={setStatus.isPending}
            className="btn btn-ghost disabled:opacity-50"
          >
            <Play size={13} />
            Reactivate
          </button>
        )}
        {status !== INFLUENCER_STATUS.BLACKLISTED && (
          <button
            type="button"
            onClick={() => setConfirmingBlacklist(true)}
            disabled={setStatus.isPending}
            className="btn btn-ghost text-rose-deep disabled:opacity-50"
          >
            <ShieldAlert size={13} />
            Blacklist
          </button>
        )}
        {status === INFLUENCER_STATUS.BLACKLISTED && (
          <button
            type="button"
            onClick={() => handleSetStatus(INFLUENCER_STATUS.ACTIVE)}
            disabled={setStatus.isPending}
            className="btn btn-ghost disabled:opacity-50"
          >
            <Play size={13} />
            Remove from blacklist
          </button>
        )}
      </div>

      {actionError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-2.5 py-1.5 text-[12px]">
          {actionError}
        </div>
      )}

      {confirmingRotate && (
        <RotateConfirmModal
          influencerName={influencer.displayName}
          portalUrl={portalUrl}
          whatsappMessage={whatsappMessage}
          isPending={rotate.isPending}
          copiedUrl={copiedUrl}
          copiedMessage={copiedMessage}
          onCopyUrl={() => copy("url", portalUrl)}
          onCopyMessage={() => copy("message", whatsappMessage)}
          onClose={() => setConfirmingRotate(false)}
          onConfirm={handleRotate}
        />
      )}
      {confirmingBlacklist && (
        <BlacklistConfirmModal
          influencerName={influencer.displayName}
          isPending={setStatus.isPending}
          onClose={() => setConfirmingBlacklist(false)}
          onConfirm={() => handleSetStatus(INFLUENCER_STATUS.BLACKLISTED)}
        />
      )}
    </div>
  );
}

function RotateConfirmModal({
  influencerName,
  portalUrl,
  whatsappMessage,
  isPending,
  copiedUrl,
  copiedMessage,
  onCopyUrl,
  onCopyMessage,
  onClose,
  onConfirm,
}: {
  influencerName: string;
  portalUrl: string;
  whatsappMessage: string;
  isPending: boolean;
  copiedUrl: boolean;
  copiedMessage: boolean;
  onCopyUrl: () => void;
  onCopyMessage: () => void;
  onClose: () => void;
  onConfirm: () => void;
}): JSX.Element {
  // Two-state flow inside the modal: pre-rotation (confirmation) vs
  // post-rotation (show the new URL + WhatsApp template). The rotate
  // mutation invalidates the influencer detail query so on success
  // `portalUrl` reflects the new token already.
  const [rotated, setRotated] = useState(false);

  const onConfirmAndShow = async (): Promise<void> => {
    await onConfirm();
    setRotated(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-paper rounded-lg shadow-lg text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h2 className="font-serif text-[18px] tracking-tight text-ink">
            {rotated ? "New portal link ready" : "Rotate portal link"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </header>
        <div className="px-5 py-5 space-y-3 text-[13px]">
          {!rotated ? (
            <>
              <p className="text-ink-2 leading-relaxed">
                This will invalidate the old link.{" "}
                <strong className="text-ink">{influencerName}</strong> will need
                the new one to access their portal.
              </p>
              <p className="text-ink-3 text-[12px]">
                Send them the new link via WhatsApp after rotation — copy
                buttons appear on the next screen.
              </p>
            </>
          ) : (
            <>
              <div className="rounded-md bg-sage/30 border border-sage-deep/30 text-[#2C5530] px-3 py-2 text-[12.5px] flex items-start gap-2">
                <Check size={13} className="mt-0.5 flex-shrink-0" />
                <span>
                  Old link is dead. Send {influencerName} this new link via
                  WhatsApp.
                </span>
              </div>
              <div>
                <label className="field-label">New portal link</label>
                <div className="flex items-center gap-1.5 rounded-md border border-line bg-cream-2/40 px-2 py-1.5">
                  <span className="font-mono text-[11.5px] text-ink-2 truncate flex-1">
                    {portalUrl}
                  </span>
                  <button
                    type="button"
                    onClick={onCopyUrl}
                    className="btn btn-ghost !px-2 !py-1 !text-[11.5px]"
                  >
                    {copiedUrl ? <Check size={11} /> : <Copy size={11} />}
                    {copiedUrl ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div>
                <label className="field-label">WhatsApp welcome message</label>
                <textarea
                  readOnly
                  value={whatsappMessage}
                  rows={4}
                  className="form-textarea !text-[12.5px]"
                />
                <button
                  type="button"
                  onClick={onCopyMessage}
                  className="btn btn-ghost mt-1.5"
                >
                  {copiedMessage ? <Check size={12} /> : <Copy size={12} />}
                  {copiedMessage ? "Copied" : "Copy message"}
                </button>
              </div>
            </>
          )}
        </div>
        <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-line">
          {!rotated ? (
            <>
              <button onClick={onClose} className="btn btn-ghost">
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmAndShow}
                disabled={isPending}
                className="btn btn-primary disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Rotating…
                  </>
                ) : (
                  <>
                    <RotateCw size={13} />
                    Confirm rotation
                  </>
                )}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="btn btn-primary">
              Done
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function BlacklistConfirmModal({
  influencerName,
  isPending,
  onClose,
  onConfirm,
}: {
  influencerName: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-paper rounded-lg shadow-lg text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h2 className="font-serif text-[18px] tracking-tight text-ink">
            Blacklist {influencerName}?
          </h2>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </header>
        <div className="px-5 py-5 text-[13px] text-ink-2 leading-relaxed space-y-3">
          <div className="flex items-start gap-2 rounded-md bg-rose/30 border border-rose-deep/30 text-[#6E2A35] px-3 py-2">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              Their portal link will stop working immediately. They won't be
              shown in dropdowns when creating new collabs.
            </span>
          </div>
          <p>
            You can remove the blacklist later — the database row stays
            intact, only their <strong>status</strong> changes.
          </p>
        </div>
        <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-line">
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="btn btn-primary disabled:opacity-50 !bg-rose-deep !text-paper"
          >
            {isPending ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Blacklisting…
              </>
            ) : (
              <>
                <ShieldAlert size={13} />
                Blacklist
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CollaborationsTable({
  collabs,
  isLoading,
  isError,
}: {
  collabs: CollabRow[];
  isLoading: boolean;
  isError: boolean;
}): JSX.Element {
  if (isLoading) {
    return <p className="text-[13px] text-ink-3">Loading collabs…</p>;
  }
  if (isError) {
    return (
      <p className="text-[13px] text-rose-deep">
        Couldn't load collabs. Try refreshing.
      </p>
    );
  }
  if (collabs.length === 0) {
    return (
      <p className="text-[13px] text-ink-3 italic">
        No collaborations yet. Create an influencer_collab calendar entry to
        link this creator.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="eyebrow">Collaborations</div>
      <div className="space-y-1.5">
        {collabs.map(({ entry, submission }) => (
          <Link
            key={entry.id}
            to={`${ROUTES.CALENDAR}?entryId=${entry.id}`}
            className="block rounded-md border border-line p-2.5 hover:border-line-2 hover:bg-cream-2/30 transition"
            title="Open the calendar entry"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-ink truncate">
                  {entry.title}
                </div>
                <div className="text-[11.5px] text-ink-3 mt-0.5">
                  {format(new Date(entry.targetDate), "MMM d, yyyy")} ·{" "}
                  <span className="capitalize">{entry.status}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {submission ? (
                  <span
                    className={`chip ${SUBMISSION_STATUS_CHIP[submission.verificationStatus]} !text-[10.5px]`}
                    title={`Submission ${INFLUENCER_SUBMISSION_STATUS_LABELS[submission.verificationStatus]}`}
                  >
                    {INFLUENCER_SUBMISSION_STATUS_LABELS[submission.verificationStatus]}
                  </span>
                ) : (
                  <span className="chip chip-default !text-[10.5px]">
                    Awaiting
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

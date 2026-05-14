import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
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
import {
  INFLUENCER_LANGUAGE_LABELS,
  type InfluencerLanguage,
} from "../constants/influencer-languages";
import {
  INFLUENCER_NICHE_TAG_LABELS,
  type InfluencerNicheTag,
} from "../constants/influencer-niche-tags";
import {
  INFLUENCER_STATUS,
  INFLUENCER_STATUS_LABELS,
  type InfluencerStatus,
} from "../constants/influencer-status";
import {
  INFLUENCER_SUBMISSION_STATUS_LABELS,
  type InfluencerSubmissionStatus,
} from "../constants/influencer-submissions";
import { CONTENT_FORMATS } from "../constants/content-formats";
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

// ─── Helpers ────────────────────────────────────────────────────────────

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

function formatFollowers(value: number | null): string {
  if (value === null || value === 0) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatBigNumber(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.[0] ?? "?").toUpperCase();
  return (
    (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")
  ).toUpperCase();
}

function portalUrl(token: string): string {
  return `${window.location.origin}/creator/${token}`;
}

// ─── Page ───────────────────────────────────────────────────────────────

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
    <div className="px-4 md:px-9 pt-5 md:pt-7 pb-12">
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
          <DetailHeader
            influencer={detail.data}
            onEdit={() => setEditing(true)}
            onDelete={onDelete}
            isDeleting={remove.isPending}
          />

          <div className="mt-5 grid grid-cols-12 gap-3 md:gap-4">
            <Tile className="col-span-12 lg:col-span-8" title="Reliability">
              <ReliabilityTile reliability={detail.data.reliability} />
            </Tile>

            <Tile className="col-span-12 lg:col-span-4" title="Performance">
              <ActivityStatsTile influencerId={detail.data.id} />
            </Tile>

            <Tile className="col-span-12 lg:col-span-7" title="Platforms">
              <PlatformsTile influencer={detail.data} />
            </Tile>

            <Tile
              className="col-span-12 lg:col-span-5"
              title="Portal management"
            >
              <PortalManagement
                influencer={detail.data}
                portalUrl={creatorPortalUrl}
              />
            </Tile>

            <Tile
              className="col-span-12 md:col-span-6 lg:col-span-4"
              title="Contact"
            >
              <ContactBlock influencer={detail.data} />
            </Tile>

            <Tile
              className="col-span-12 md:col-span-6 lg:col-span-3"
              title="Commercials"
            >
              <CommercialsBlock
                rate={detail.data.standardRate}
                barter={detail.data.acceptsBarter}
              />
            </Tile>

            <Tile className="col-span-12 lg:col-span-5" title="Content fit">
              <ContentFitBlock
                nicheTags={detail.data.nicheTags}
                languages={detail.data.languages}
              />
            </Tile>

            <Tile className="col-span-12" title="Collaborations">
              <CollaborationsTile influencerId={detail.data.id} />
            </Tile>

            {detail.data.notes && detail.data.notes.trim() !== "" && (
              <Tile className="col-span-12" title="Notes">
                <p className="whitespace-pre-wrap text-[13px] text-ink-2 leading-relaxed">
                  {detail.data.notes}
                </p>
              </Tile>
            )}
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

// ─── Header ─────────────────────────────────────────────────────────────

function DetailHeader({
  influencer,
  onEdit,
  onDelete,
  isDeleting,
}: {
  influencer: InfluencerWithReliability;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}): JSX.Element {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-cream-2 border border-line grid place-items-center text-ink font-serif text-[18px] md:text-[20px] font-semibold flex-shrink-0">
          {getInitials(influencer.displayName)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="h-greeting text-[22px] md:text-[26px] break-words">
              {influencer.displayName}
            </h1>
            <span className={`chip ${statusChipClass(influencer.status)}`}>
              {INFLUENCER_STATUS_LABELS[influencer.status]}
            </span>
          </div>
          <p className="text-[12.5px] md:text-[13px] text-ink-2 mt-0.5">
            {influencer.whatsapp}
            {influencer.city ? ` · ${influencer.city}` : ""}
            {influencer.fullName &&
            influencer.fullName !== influencer.displayName
              ? ` · ${influencer.fullName}`
              : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onEdit} className="btn btn-ghost">
          <Pencil size={14} />
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="px-3 py-2 text-[13px] text-rose-deep hover:brightness-90 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </header>
  );
}

// ─── Tile primitive ─────────────────────────────────────────────────────

function Tile({
  title,
  sub,
  children,
  className = "",
}: {
  title: string;
  sub?: string | null;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section
      className={`bg-paper border border-line rounded-lg p-3.5 md:p-4 ${className}`}
    >
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="h-card-sm">{title}</h2>
        {sub ? (
          <span className="text-[11px] text-ink-3 font-medium">{sub}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// ─── Reliability ────────────────────────────────────────────────────────

// Same solid-pastel + dark-text pattern as StatTile / chip-*.
function reliabilityTone(value: number | null): string {
  if (value === null) return "bg-cream-2 text-ink-3";
  if (value >= 80) return "bg-sage text-[#2C5530]";
  if (value >= 50) return "bg-butter text-[#6B4A0F]";
  return "bg-rose text-[#6E2A35]";
}

function ReliabilityTile({
  reliability,
}: {
  reliability: InfluencerReliability | null;
}): JSX.Element {
  const totalCollabs = reliability?.totalCollabs ?? 0;

  const previewLabels = [
    { key: "post", label: "Post rate" },
    { key: "tag", label: "Tag rate" },
    { key: "ontime", label: "On-time" },
  ];

  // Gated: < 3 collabs. Compact dots-progress + dimmed preview of what
  // the unlocked tile will look like, so the user sees what they're
  // working toward without leaving the tile feeling empty.
  if (!reliability || totalCollabs < RELIABILITY_MIN_COLLABS) {
    const dots = Array.from({ length: RELIABILITY_MIN_COLLABS }).map(
      (_, i) => i < totalCollabs,
    );
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex gap-1.5">
            {dots.map((filled, i) => (
              <span
                key={i}
                className={
                  filled
                    ? "w-2.5 h-2.5 rounded-full bg-obsidian"
                    : "w-2.5 h-2.5 rounded-full bg-cream-2 border border-line-2"
                }
              />
            ))}
          </div>
          <div className="text-[13px] text-ink-2">
            <span className="font-semibold text-ink tabular-nums">
              {totalCollabs}
            </span>{" "}
            of {RELIABILITY_MIN_COLLABS} collabs ·{" "}
            <span className="text-ink-3">
              Score unlocks at {RELIABILITY_MIN_COLLABS}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 opacity-50">
          {previewLabels.map((p) => (
            <div
              key={p.key}
              className="rounded-md px-3 py-2.5 bg-cream-2/60 border border-dashed border-line-2"
            >
              <div className="text-[9.5px] uppercase tracking-[0.14em] text-ink-3 font-semibold">
                {p.label}
              </div>
              <div className="font-serif text-[24px] font-semibold tabular-nums text-ink-3 leading-none mt-1.5">
                —
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const rates = [
    { key: "post", label: "Post rate", value: reliability.postRate },
    { key: "tag", label: "Tag rate", value: reliability.tagRate },
    { key: "ontime", label: "On-time", value: reliability.onTimeRate },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {rates.map((r) => (
          <div
            key={r.key}
            className={`rounded-md px-3 py-2.5 ${reliabilityTone(r.value)}`}
          >
            <div className="text-[9.5px] uppercase tracking-[0.14em] font-semibold opacity-75">
              {r.label}
            </div>
            <div className="font-serif text-[24px] font-semibold tabular-nums leading-none mt-1.5">
              {r.value === null ? "—" : `${r.value}%`}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-ink-3 mt-2.5">
        {totalCollabs} collab{totalCollabs === 1 ? "" : "s"} ·{" "}
        {reliability.totalSubmissions} submission
        {reliability.totalSubmissions === 1 ? "" : "s"} · scored{" "}
        {format(new Date(reliability.computedAt), "MMM d, yyyy")}
      </p>
    </div>
  );
}

// ─── Platforms ──────────────────────────────────────────────────────────

const PLATFORM_META = {
  tiktok: { label: "TikTok", chip: "chip-tiktok" },
  instagram: { label: "Instagram", chip: "chip-ig" },
  snapchat: { label: "Snapchat", chip: "chip-snap" },
} as const;

function PlatformRow({
  platform,
  handle,
  url,
  followers,
}: {
  platform: keyof typeof PLATFORM_META;
  handle: string | null;
  url: string | null;
  followers: number | null;
}): JSX.Element {
  const meta = PLATFORM_META[platform];
  const isLinked = handle !== null && handle !== "";

  return (
    <div className="flex items-center gap-3 py-2 border-b border-line last:border-b-0">
      <span
        className={`chip ${meta.chip} !text-[10.5px] flex-shrink-0 w-[80px] justify-center`}
      >
        {meta.label}
      </span>
      {isLinked ? (
        <>
          <span className="text-[13px] text-ink-2 truncate flex-1">
            @{handle.replace(/^@+/, "")}
          </span>
          <span className="text-[12.5px] tabular-nums text-ink-2 flex-shrink-0">
            {formatFollowers(followers)}
          </span>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="iconbtn !w-7 !h-7 flex-shrink-0"
              title={`Open ${meta.label}`}
              aria-label={`Open ${meta.label}`}
            >
              <ExternalLink size={12} />
            </a>
          ) : (
            <span className="w-7" />
          )}
        </>
      ) : (
        <span className="text-[12.5px] text-ink-3 italic flex-1">
          Not linked
        </span>
      )}
    </div>
  );
}

function PlatformsTile({
  influencer,
}: {
  influencer: InfluencerWithReliability;
}): JSX.Element {
  return (
    <div>
      <PlatformRow
        platform="tiktok"
        handle={influencer.tiktokHandle}
        url={influencer.tiktokUrl}
        followers={influencer.tiktokFollowers}
      />
      <PlatformRow
        platform="instagram"
        handle={influencer.instagramHandle}
        url={influencer.instagramUrl}
        followers={influencer.instagramFollowers}
      />
      <PlatformRow
        platform="snapchat"
        handle={influencer.snapchatHandle}
        url={influencer.snapchatUrl}
        followers={influencer.snapchatFollowers}
      />
    </div>
  );
}

// ─── Inline row / Contact / Commercials / Content fit ──────────────────

function InlineRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-line last:border-b-0">
      <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3 font-semibold flex-shrink-0">
        {label}
      </span>
      <span className="text-[13px] text-ink text-right break-words min-w-0">
        {formatValue(value)}
      </span>
    </div>
  );
}

function ContactBlock({
  influencer,
}: {
  influencer: InfluencerWithReliability;
}): JSX.Element {
  return (
    <div>
      <InlineRow label="Display" value={influencer.displayName} />
      <InlineRow label="Full name" value={influencer.fullName} />
      <InlineRow label="WhatsApp" value={influencer.whatsapp} />
      <InlineRow label="City" value={influencer.city} />
    </div>
  );
}

function CommercialsBlock({
  rate,
  barter,
}: {
  rate: number | null;
  barter: boolean;
}): JSX.Element {
  return (
    <div>
      <InlineRow label="Std. rate" value={formatMoney(rate)} />
      <InlineRow label="Barter" value={barter ? "Yes" : "No"} />
    </div>
  );
}

function ContentFitBlock({
  nicheTags,
  languages,
}: {
  nicheTags: InfluencerNicheTag[];
  languages: InfluencerLanguage[];
}): JSX.Element {
  return (
    <div className="space-y-3">
      <ChipGroup
        label="Niche"
        values={nicheTags.map((tag) => INFLUENCER_NICHE_TAG_LABELS[tag])}
        emptyLabel="No tags"
      />
      <ChipGroup
        label="Languages"
        values={languages.map((l) => INFLUENCER_LANGUAGE_LABELS[l])}
        emptyLabel="No languages"
      />
    </div>
  );
}

function ChipGroup({
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
      <div className="eyebrow mb-1.5">{label}</div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span key={value} className="chip chip-default">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-3 italic">{emptyLabel}</p>
      )}
    </div>
  );
}

// ─── Performance stats ──────────────────────────────────────────────────

type StatAccent = "sky" | "sage" | "butter" | "lavender";

// Solid pastel backgrounds with matching dark companion text — same
// pattern as the existing chip-* classes so they read on both light
// and dark canvases without separate dark-mode overrides.
const STAT_TINTS: Record<StatAccent, string> = {
  sky: "bg-sky text-[#2C4A66]",
  sage: "bg-sage text-[#2C5530]",
  butter: "bg-butter text-[#6B4A0F]",
  lavender: "bg-lavender text-[#4A3A6A]",
};

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: StatAccent;
}): JSX.Element {
  return (
    <div className={`rounded-md px-3 py-2.5 ${STAT_TINTS[accent]}`}>
      <div className="text-[9.5px] uppercase tracking-[0.14em] font-semibold opacity-75">
        {label}
      </div>
      <div className="font-serif text-[22px] font-semibold tabular-nums leading-none mt-1.5">
        {value}
      </div>
    </div>
  );
}

function ActivityStatsTile({
  influencerId,
}: {
  influencerId: string;
}): JSX.Element {
  const entries = useCalendarEntries({ influencerId });
  const submissions = useInfluencerSubmissions({ influencerId });

  const stats = useMemo(() => {
    let totalSubmissions = 0;
    let verifiedCount = 0;
    let views = 0;
    let engagementSum = 0; // likes + comments + shares
    for (const s of submissions.data ?? []) {
      totalSubmissions += 1;
      if (s.verificationStatus === "verified") verifiedCount += 1;
      for (const log of s.performanceLogs ?? []) {
        views += log.views ?? 0;
        engagementSum +=
          (log.likes ?? 0) + (log.comments ?? 0) + (log.shares ?? 0);
      }
    }
    const totalCollabs = (entries.data ?? []).filter(
      (e) => e.format === CONTENT_FORMATS.INFLUENCER_COLLAB,
    ).length;
    return {
      totalCollabs,
      totalSubmissions,
      verifiedCount,
      views,
      engagementSum,
    };
  }, [entries.data, submissions.data]);

  const isLoading = entries.isLoading || submissions.isLoading;

  if (isLoading) {
    return <p className="text-[13px] text-ink-3">Loading…</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatTile label="Collabs" value={stats.totalCollabs} accent="sky" />
      <StatTile
        label="Verified"
        value={`${stats.verifiedCount}/${stats.totalSubmissions || 0}`}
        accent="sage"
      />
      <StatTile
        label="Views"
        value={formatBigNumber(stats.views)}
        accent="butter"
      />
      <StatTile
        label="Engagement"
        value={formatBigNumber(stats.engagementSum)}
        accent="lavender"
      />
    </div>
  );
}

// ─── Collaborations ─────────────────────────────────────────────────────

const SUBMISSION_STATUS_CHIP: Record<InfluencerSubmissionStatus, string> = {
  pending: "bg-yellow text-obsidian",
  verified: "bg-sage text-[#2C5530]",
  disputed: "bg-rose text-[#6E2A35]",
};

interface CollabRow {
  entry: CalendarEntry;
  submission: InfluencerSubmissionListItem | null;
}

function CollaborationsTile({
  influencerId,
}: {
  influencerId: string;
}): JSX.Element {
  const entries = useCalendarEntries({ influencerId });
  const submissions = useInfluencerSubmissions({ influencerId });

  const submissionByEntry = useMemo(() => {
    const map = new Map<string, InfluencerSubmissionListItem>();
    for (const s of submissions.data ?? []) {
      const existing = map.get(s.entryId);
      if (
        !existing ||
        new Date(s.submittedAt) > new Date(existing.submittedAt)
      ) {
        map.set(s.entryId, s);
      }
    }
    return map;
  }, [submissions.data]);

  const collabs: CollabRow[] = useMemo(() => {
    const rows = (entries.data ?? []).filter(
      (e) => e.format === CONTENT_FORMATS.INFLUENCER_COLLAB,
    );
    return rows.map((entry) => ({
      entry,
      submission: submissionByEntry.get(entry.id) ?? null,
    }));
  }, [entries.data, submissionByEntry]);

  const isLoading = entries.isLoading || submissions.isLoading;
  const isError = entries.isError || submissions.isError;

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
      {collabs.map(({ entry, submission }) => (
        <Link
          key={entry.id}
          to={`${ROUTES.CALENDAR}?entryId=${entry.id}`}
          className="flex items-center gap-3 rounded-md border border-line px-3 py-2 hover:border-line-2 hover:bg-cream-2/30 transition"
          title="Open the calendar entry"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-ink truncate font-medium">
              {entry.title}
            </div>
            <div className="text-[11.5px] text-ink-3 mt-0.5">
              {format(new Date(entry.targetDate), "MMM d, yyyy")} ·{" "}
              <span className="capitalize">{entry.status}</span>
            </div>
          </div>
          {submission ? (
            <span
              className={`chip ${SUBMISSION_STATUS_CHIP[submission.verificationStatus]} !text-[10.5px]`}
              title={`Submission ${INFLUENCER_SUBMISSION_STATUS_LABELS[submission.verificationStatus]}`}
            >
              {
                INFLUENCER_SUBMISSION_STATUS_LABELS[
                  submission.verificationStatus
                ]
              }
            </span>
          ) : (
            <span className="chip chip-default !text-[10.5px]">Awaiting</span>
          )}
          <ChevronRight
            size={14}
            className="text-ink-3 flex-shrink-0"
          />
        </Link>
      ))}
    </div>
  );
}

// ─── Portal management ──────────────────────────────────────────────────

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

  const copy = async (
    kind: "url" | "message",
    value: string,
  ): Promise<void> => {
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
      const message =
        err instanceof Error ? err.message : "Status change failed.";
      setActionError(message);
    }
  };

  return (
    <div className="space-y-3 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Status</span>
        <span className={`chip ${statusBadgeClass(status)} font-semibold`}>
          {INFLUENCER_STATUS_LABELS[status]}
        </span>
      </div>

      <div>
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

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => setConfirmingRotate(true)}
          disabled={rotate.isPending}
          className="btn btn-ghost !py-1.5 !text-[12px] disabled:opacity-50"
        >
          <RotateCw size={12} />
          Rotate
        </button>
        {status === INFLUENCER_STATUS.ACTIVE && (
          <button
            type="button"
            onClick={() => handleSetStatus(INFLUENCER_STATUS.PAUSED)}
            disabled={setStatus.isPending}
            className="btn btn-ghost !py-1.5 !text-[12px] disabled:opacity-50"
          >
            <Pause size={12} />
            Pause
          </button>
        )}
        {status === INFLUENCER_STATUS.PAUSED && (
          <button
            type="button"
            onClick={() => handleSetStatus(INFLUENCER_STATUS.ACTIVE)}
            disabled={setStatus.isPending}
            className="btn btn-ghost !py-1.5 !text-[12px] disabled:opacity-50"
          >
            <Play size={12} />
            Reactivate
          </button>
        )}
        {status !== INFLUENCER_STATUS.BLACKLISTED && (
          <button
            type="button"
            onClick={() => setConfirmingBlacklist(true)}
            disabled={setStatus.isPending}
            className="btn btn-ghost !py-1.5 !text-[12px] text-rose-deep disabled:opacity-50 col-span-2"
          >
            <ShieldAlert size={12} />
            Blacklist
          </button>
        )}
        {status === INFLUENCER_STATUS.BLACKLISTED && (
          <button
            type="button"
            onClick={() => handleSetStatus(INFLUENCER_STATUS.ACTIVE)}
            disabled={setStatus.isPending}
            className="btn btn-ghost !py-1.5 !text-[12px] disabled:opacity-50 col-span-2"
          >
            <Play size={12} />
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
  // Two-state flow: pre-rotation confirmation vs post-rotation reveal of
  // the new URL + WhatsApp template. Rotate invalidates the detail query
  // so portalUrl already reflects the new token on success.
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
            You can remove the blacklist later — the database row stays intact,
            only their <strong>status</strong> changes.
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

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RotateCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ROUTES } from "../../constants/routes";
import {
  INFLUENCER_LANGUAGE_LABELS,
  type InfluencerLanguage,
} from "../../constants/influencer-languages";
import {
  INFLUENCER_NICHE_TAG_LABELS,
  type InfluencerNicheTag,
} from "../../constants/influencer-niche-tags";
import {
  INFLUENCER_STATUS,
  INFLUENCER_STATUS_LABELS,
  type InfluencerStatus,
} from "../../constants/influencer-status";
import {
  INFLUENCER_SUBMISSION_STATUS_LABELS,
  type InfluencerSubmissionStatus,
} from "../../constants/influencer-submissions";
import { CONTENT_FORMATS } from "../../constants/content-formats";
import {
  classifyTier,
  highestFollowerCount,
  INFLUENCER_TIER_LABELS,
} from "../../constants/influencer-tiers";
import {
  useRotateInfluencerToken,
  useUpdateInfluencer,
  useUpdateInfluencerStatus,
} from "./hooks/use-influencers";
import { useInfluencerSubmissions } from "./hooks/use-influencer-submissions";
import { useCalendarEntries } from "../calendar/hooks/use-calendar-entries";
import { RELIABILITY_MIN_COLLABS, statusBadgeClass } from "./utils/influencer-format";
import { InstagramIcon, SnapchatIcon, TikTokIcon } from "./icons";
import type { CalendarEntry } from "../../types/calendar-entry";
import type { InfluencerSubmissionListItem } from "../../types/influencer-submission";
import type {
  InfluencerReliability,
  InfluencerWithReliability,
} from "../../types/influencer";
import { logger } from "../../utils/logger";

// Shared influencer-detail tiles. Both the full-page route AND the
// right-side slide-out panel render these — no logic duplication. Visual
// language matches the panel mockup (eyebrow section labels, pastel stat
// cards, icon platform rows, progress-bar reliability).

const EMPTY_VALUE = "Not set";

// ─── Format helpers ─────────────────────────────────────────────────────

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

function formatFollowers(value: number): string {
  if (value <= 0) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

// "Cost per 1000 followers" — std rate ÷ (followers / 1000). A rough
// value-for-money proxy (we have no impression data), labelled CPM to
// match the mockup. Returns null when either input is missing.
function formatCpm(rate: number | null, followers: number): string | null {
  if (rate === null || followers <= 0) return null;
  return `${(rate / (followers / 1000)).toFixed(2)} SAR / 1K`;
}

// ─── Primary platform ───────────────────────────────────────────────────

interface PlatformInfo {
  platform: "tiktok" | "instagram" | "snapchat";
  handle: string | null;
  url: string | null;
  followers: number;
}

function platformList(influencer: InfluencerWithReliability): PlatformInfo[] {
  return [
    {
      platform: "tiktok",
      handle: influencer.tiktokHandle,
      url: influencer.tiktokUrl,
      followers: influencer.tiktokFollowers ?? 0,
    },
    {
      platform: "instagram",
      handle: influencer.instagramHandle,
      url: influencer.instagramUrl,
      followers: influencer.instagramFollowers ?? 0,
    },
    {
      platform: "snapchat",
      handle: influencer.snapchatHandle,
      url: influencer.snapchatUrl,
      followers: influencer.snapchatFollowers ?? 0,
    },
  ];
}

// Highest-follower linked platform — drives the PRIMARY tag and the
// "Primary handle" contact row.
function primaryPlatform(
  influencer: InfluencerWithReliability,
): PlatformInfo | null {
  const linked = platformList(influencer).filter(
    (p) => p.handle !== null && p.handle !== "",
  );
  if (linked.length === 0) return null;
  return [...linked].sort((a, b) => b.followers - a.followers)[0] ?? null;
}

// ─── Tile primitive ─────────────────────────────────────────────────────

export function Tile({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section
      className={`bg-paper border border-line rounded-xl p-4 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="eyebrow">{title}</h2>
        {action ?? null}
      </div>
      {children}
    </section>
  );
}

// ─── Stat cards (panel summary row) ─────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  tint: string;
}): JSX.Element {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${tint}`}>
      <div className="text-[9px] uppercase tracking-[0.12em] font-semibold opacity-70">
        {label}
      </div>
      <div className="font-serif text-[20px] font-bold tabular-nums leading-none mt-1.5">
        {value}
      </div>
      {sub && <div className="text-[10px] opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

export function PanelStatCards({
  influencer,
}: {
  influencer: InfluencerWithReliability;
}): JSX.Element {
  const submissions = useInfluencerSubmissions({ influencerId: influencer.id });

  const { views, engagement } = useMemo(() => {
    let v = 0;
    let e = 0;
    for (const s of submissions.data ?? []) {
      for (const log of s.performanceLogs ?? []) {
        v += log.views ?? 0;
        e += (log.likes ?? 0) + (log.comments ?? 0) + (log.shares ?? 0);
      }
    }
    return { views: v, engagement: e };
  }, [submissions.data]);

  const followers = highestFollowerCount(influencer);
  const tier = classifyTier(followers);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <StatCard
        tint="bg-[#FAF3DC] text-[#6B4A0F]"
        label="Followers"
        value={formatFollowers(followers)}
        sub={tier ? `${INFLUENCER_TIER_LABELS[tier]} tier` : undefined}
      />
      <StatCard
        tint="bg-sage text-[#2C5530]"
        label="Std. rate"
        value={
          influencer.standardRate !== null
            ? `${influencer.standardRate.toLocaleString()} SAR`
            : "—"
        }
        sub={
          influencer.standardRate !== null
            ? influencer.acceptsBarter
              ? "+ barter"
              : "Cash only"
            : undefined
        }
      />
      <StatCard
        tint="bg-butter text-[#6B4A0F]"
        label="Engagement"
        value={engagement > 0 ? formatFollowers(engagement) : "—"}
        sub="logged total"
      />
      <StatCard
        tint="bg-lavender text-[#4A3A6A]"
        label="Views"
        value={views > 0 ? formatFollowers(views) : "—"}
        sub="logged total"
      />
    </div>
  );
}

// ─── Reliability (progress bars) ────────────────────────────────────────

function barTone(value: number | null): string {
  if (value === null) return "bg-cream-2";
  if (value >= 80) return "bg-sage-deep";
  if (value >= 50) return "bg-[#B88A2A]";
  return "bg-rose-deep";
}

export function ReliabilityTile({
  reliability,
}: {
  reliability: InfluencerReliability | null;
}): JSX.Element {
  const totalCollabs = reliability?.totalCollabs ?? 0;
  const gated = !reliability || totalCollabs < RELIABILITY_MIN_COLLABS;

  if (gated) {
    const dots = Array.from({ length: RELIABILITY_MIN_COLLABS }).map(
      (_, i) => i < totalCollabs,
    );
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex gap-1.5">
            {dots.map((filled, i) => (
              <span
                key={i}
                className={
                  filled
                    ? "w-2 h-2 rounded-full bg-obsidian"
                    : "w-2 h-2 rounded-full bg-cream-2 border border-line-2"
                }
              />
            ))}
          </div>
          <span className="text-[12px] text-ink-3">
            {totalCollabs} of {RELIABILITY_MIN_COLLABS} collabs · unlocks at{" "}
            {RELIABILITY_MIN_COLLABS}
          </span>
        </div>
        <div className="space-y-2.5 opacity-50">
          {["Post", "Tag", "On-time"].map((label) => (
            <ReliabilityBar key={label} label={label} value={null} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-obsidian" />
          ))}
        </div>
        <span className="text-[12px] text-ink-3">Score active</span>
      </div>
      <div className="space-y-2.5">
        <ReliabilityBar label="Post" value={reliability.postRate} />
        <ReliabilityBar label="Tag" value={reliability.tagRate} />
        <ReliabilityBar label="On-time" value={reliability.onTimeRate} />
      </div>
    </div>
  );
}

function ReliabilityBar({
  label,
  value,
}: {
  label: string;
  value: number | null;
}): JSX.Element {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className="text-ink-2">{label}</span>
        <span className="font-semibold tabular-nums text-ink">
          {value === null ? "—" : `${value}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-cream-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${barTone(value)}`}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  );
}

// ─── Platforms (icon rows) ──────────────────────────────────────────────

function PlatformIconCircle({
  platform,
}: {
  platform: PlatformInfo["platform"];
}): JSX.Element {
  if (platform === "tiktok") {
    return (
      <span className="w-8 h-8 rounded-full bg-obsidian grid place-items-center flex-shrink-0">
        <TikTokIcon className="w-4 h-4 text-white" />
      </span>
    );
  }
  if (platform === "instagram") {
    return (
      <span
        className="w-8 h-8 rounded-full grid place-items-center flex-shrink-0"
        style={{
          background:
            "linear-gradient(45deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
        }}
      >
        <InstagramIcon className="w-4 h-4 text-white" />
      </span>
    );
  }
  return (
    <span className="w-8 h-8 rounded-full bg-[#FFFC00] grid place-items-center flex-shrink-0">
      <SnapchatIcon className="w-4 h-4 text-obsidian" />
    </span>
  );
}

const PLATFORM_LABEL: Record<PlatformInfo["platform"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
};

function PlatformRow({
  info,
  isPrimary,
  onLink,
}: {
  info: PlatformInfo;
  isPrimary: boolean;
  onLink?: () => void;
}): JSX.Element {
  const isLinked = info.handle !== null && info.handle !== "";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line last:border-b-0">
      <PlatformIconCircle platform={info.platform} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-ink">
            {PLATFORM_LABEL[info.platform]}
          </span>
          {isPrimary && (
            <span className="chip chip-snap !text-[8.5px] !px-1.5 !py-0 uppercase tracking-wide">
              Primary
            </span>
          )}
        </div>
        {isLinked ? (
          <span className="text-[11.5px] text-ink-3 truncate block">
            @{info.handle?.replace(/^@+/, "")}
          </span>
        ) : (
          <span className="text-[11.5px] text-ink-3 italic">Not linked</span>
        )}
      </div>
      {isLinked ? (
        <div className="flex items-center gap-2 flex-shrink-0 text-right">
          <div>
            <div className="text-[13px] font-semibold tabular-nums text-ink leading-none">
              {formatFollowers(info.followers)}
            </div>
            <div className="text-[8.5px] uppercase tracking-wide text-ink-3 mt-0.5">
              Followers
            </div>
          </div>
          {info.url && (
            <a
              href={info.url}
              target="_blank"
              rel="noreferrer"
              className="iconbtn !w-7 !h-7"
              title={`Open ${PLATFORM_LABEL[info.platform]}`}
              aria-label={`Open ${PLATFORM_LABEL[info.platform]}`}
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onLink}
          disabled={!onLink}
          className="text-[11px] font-semibold uppercase tracking-wide text-ink-3 hover:text-ink disabled:cursor-default flex-shrink-0"
        >
          Link
        </button>
      )}
    </div>
  );
}

export function PlatformsTile({
  influencer,
  onManage,
}: {
  influencer: InfluencerWithReliability;
  onManage?: () => void;
}): JSX.Element {
  const primary = primaryPlatform(influencer);
  return (
    <div>
      {platformList(influencer).map((info) => (
        <PlatformRow
          key={info.platform}
          info={info}
          isPrimary={primary?.platform === info.platform}
          onLink={onManage}
        />
      ))}
    </div>
  );
}

// ─── Inline row / Contact / Commercials / Content fit ──────────────────

function InlineRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-line last:border-b-0">
      <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3 font-semibold flex-shrink-0">
        {label}
      </span>
      <span
        className={`text-[13px] text-ink text-right break-words min-w-0 ${mono ? "font-mono !text-[12px]" : ""}`}
      >
        {formatValue(value)}
      </span>
    </div>
  );
}

export function ContactBlock({
  influencer,
}: {
  influencer: InfluencerWithReliability;
}): JSX.Element {
  const primary = primaryPlatform(influencer);
  return (
    <div>
      <InlineRow label="Display name" value={influencer.displayName} />
      <InlineRow label="WhatsApp" value={influencer.whatsapp} />
      <InlineRow
        label="Primary handle"
        value={primary?.handle ? `@${primary.handle.replace(/^@+/, "")}` : null}
      />
      <InlineRow label="City" value={influencer.city} />
    </div>
  );
}

export function CommercialsBlock({
  rate,
  barter,
  followers,
}: {
  rate: number | null;
  barter: boolean;
  followers: number;
}): JSX.Element {
  return (
    <div>
      <InlineRow label="Std. rate" value={formatMoney(rate)} />
      <InlineRow label="Barter" value={barter ? "Yes" : "No"} />
      <InlineRow label="Min CPM" value={formatCpm(rate, followers)} />
    </div>
  );
}

export function ContentFitBlock({
  nicheTags,
  languages,
  city,
}: {
  nicheTags: InfluencerNicheTag[];
  languages: InfluencerLanguage[];
  city: string | null;
}): JSX.Element {
  return (
    <div className="space-y-3">
      <ChipRow
        label="Niches"
        values={nicheTags.map((tag) => INFLUENCER_NICHE_TAG_LABELS[tag])}
        emptyLabel="No tags"
      />
      <ChipRow
        label="Languages"
        values={languages.map((l) => INFLUENCER_LANGUAGE_LABELS[l])}
        emptyLabel="No languages"
      />
      <ChipRow label="City" values={city ? [city] : []} emptyLabel="—" />
    </div>
  );
}

// Label on the left, chips on the right — matches the mockup's CONTENT FIT.
function ChipRow({
  label,
  values,
  emptyLabel,
}: {
  label: string;
  values: string[];
  emptyLabel: string;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3 font-semibold mt-1 flex-shrink-0">
        {label}
      </span>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 justify-end">
          {values.map((value) => (
            <span key={value} className="chip chip-default">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[12.5px] text-ink-3 italic">{emptyLabel}</span>
      )}
    </div>
  );
}

// ─── Performance stats (page Performance tile) ──────────────────────────

type StatAccent = "sky" | "sage" | "butter" | "lavender";

const STAT_TINTS: Record<StatAccent, string> = {
  sky: "bg-sky text-[#2C4A66]",
  sage: "bg-sage text-[#2C5530]",
  butter: "bg-butter text-[#6B4A0F]",
  lavender: "bg-lavender text-[#4A3A6A]",
};

function PerfStat({
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

export function ActivityStatsTile({
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
    let engagementSum = 0;
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
    return { totalCollabs, totalSubmissions, verifiedCount, views, engagementSum };
  }, [entries.data, submissions.data]);

  if (entries.isLoading || submissions.isLoading) {
    return <p className="text-[13px] text-ink-3">Loading…</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <PerfStat label="Collabs" value={stats.totalCollabs} accent="sky" />
      <PerfStat
        label="Verified"
        value={`${stats.verifiedCount}/${stats.totalSubmissions || 0}`}
        accent="sage"
      />
      <PerfStat label="Views" value={formatFollowers(stats.views)} accent="butter" />
      <PerfStat
        label="Engagement"
        value={formatFollowers(stats.engagementSum)}
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

const COLLAB_PREVIEW_COUNT = 3;

interface CollabRow {
  entry: CalendarEntry;
  submission: InfluencerSubmissionListItem | null;
}

export function CollaborationsTile({
  influencerId,
}: {
  influencerId: string;
}): JSX.Element {
  const entries = useCalendarEntries({ influencerId });
  const submissions = useInfluencerSubmissions({ influencerId });
  const [expanded, setExpanded] = useState(false);

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
    const rows = (entries.data ?? [])
      .filter((e) => e.format === CONTENT_FORMATS.INFLUENCER_COLLAB)
      .sort((a, b) => b.targetDate.localeCompare(a.targetDate));
    return rows.map((entry) => ({
      entry,
      submission: submissionByEntry.get(entry.id) ?? null,
    }));
  }, [entries.data, submissionByEntry]);

  if (entries.isLoading || submissions.isLoading) {
    return <p className="text-[13px] text-ink-3">Loading collabs…</p>;
  }
  if (entries.isError || submissions.isError) {
    return (
      <p className="text-[13px] text-rose-deep">
        Couldn't load collabs. Try refreshing.
      </p>
    );
  }
  if (collabs.length === 0) {
    return (
      <p className="text-[13px] text-ink-3 italic">
        No collaborations yet. Book one from the influencer card or a calendar
        entry.
      </p>
    );
  }

  const visible = expanded ? collabs : collabs.slice(0, COLLAB_PREVIEW_COUNT);
  const hiddenCount = collabs.length - COLLAB_PREVIEW_COUNT;

  return (
    <div>
      <div className="space-y-1.5">
        {visible.map(({ entry, submission }) => (
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
                className={`chip ${SUBMISSION_STATUS_CHIP[submission.verificationStatus]} !text-[10px] uppercase tracking-wide`}
              >
                {INFLUENCER_SUBMISSION_STATUS_LABELS[submission.verificationStatus]}
              </span>
            ) : (
              <span className="chip chip-default !text-[10px] uppercase tracking-wide">
                Awaiting
              </span>
            )}
            {entry.budgetAllocated > 0 && (
              <span className="text-[12px] font-semibold tabular-nums text-ink flex-shrink-0">
                {entry.budgetAllocated.toLocaleString()} SAR
              </span>
            )}
            <ChevronRight size={14} className="text-ink-3 flex-shrink-0" />
          </Link>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[12px] text-ink-3 hover:text-ink mt-2"
        >
          {expanded ? "Show less" : `View ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}

// ─── Notes (editable) ───────────────────────────────────────────────────

export function NotesTile({
  influencer,
}: {
  influencer: InfluencerWithReliability;
}): JSX.Element {
  const update = useUpdateInfluencer();
  const [value, setValue] = useState(influencer.notes ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const original = influencer.notes ?? "";
  const dirty = value.trim() !== original.trim();

  const onSave = async (): Promise<void> => {
    setError(null);
    try {
      await update.mutateAsync({
        id: influencer.id,
        input: { notes: value.trim() === "" ? null : value.trim() },
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save.";
      setError(message);
      logger.error("notes save failed", { err: message });
    }
  };

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Add private notes about response time, content quality, contract terms, etc."
        className="form-textarea !text-[13px]"
      />
      <div className="flex items-center gap-2 mt-1.5 min-h-[28px]">
        {dirty && (
          <button
            type="button"
            onClick={onSave}
            disabled={update.isPending}
            className="btn btn-ghost !py-1 !text-[12px] disabled:opacity-50"
          >
            {update.isPending ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save notes"
            )}
          </button>
        )}
        {saved && !dirty && (
          <span className="text-[12px] text-[#2C5530] flex items-center gap-1">
            <Check size={12} />
            Saved
          </span>
        )}
        {error && <span className="text-[12px] text-rose-deep">{error}</span>}
      </div>
    </div>
  );
}

// ─── Portal management ──────────────────────────────────────────────────

export function PortalManagement({
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
  const [rotated, setRotated] = useState(false);

  const onConfirmAndShow = async (): Promise<void> => {
    await onConfirm();
    setRotated(true);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
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

import { useMemo } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_COLORS,
  type SocialPlatform,
} from "../../constants/social-platform";
import type { PerformanceSnapshot } from "../../types/performance";

interface Props {
  snapshots: PerformanceSnapshot[];
  today: string;
}

interface Stats {
  current: number | null;
  delta7: number | null;
  delta30: number | null;
  // Last 30 days of follower counts (oldest → newest), used for the sparkline.
  spark: number[];
}

const PLATFORMS: readonly SocialPlatform[] = [
  SOCIAL_PLATFORMS.TIKTOK,
  SOCIAL_PLATFORMS.INSTAGRAM,
  SOCIAL_PLATFORMS.SNAPCHAT,
];

function statsFor(
  snapshots: PerformanceSnapshot[],
  platform: SocialPlatform,
  today: string,
): Stats {
  const platformSnaps = snapshots
    .filter((s) => s.platform === platform && s.followers !== null)
    .sort((a, b) => (a.snapshotDate < b.snapshotDate ? 1 : -1));

  if (platformSnaps.length === 0) {
    return { current: null, delta7: null, delta30: null, spark: [] };
  }
  const todayDate = parseISO(today);
  const latest = platformSnaps[0]!;
  const current = latest.followers;

  const findClosestBefore = (days: number): PerformanceSnapshot | undefined => {
    const target = differenceInCalendarDays(todayDate, parseISO(latest.snapshotDate)) + days;
    return platformSnaps.find(
      (s) => differenceInCalendarDays(todayDate, parseISO(s.snapshotDate)) >= target,
    );
  };

  const delta = (days: number): number | null => {
    const past = findClosestBefore(days);
    if (!past || past.followers === null || current === null) return null;
    return current - past.followers;
  };

  // Build a chronological series of follower counts for the sparkline.
  // Oldest first so the line draws left → right (intuitive direction of time).
  const spark = [...platformSnaps]
    .reverse()
    .map((s) => s.followers)
    .filter((n): n is number => n !== null);

  return { current, delta7: delta(7), delta30: delta(30), spark };
}

// Tiny inline SVG sparkline. We avoid a charting library here so the cards
// stay lightweight — the big chart below already runs Recharts.
function Sparkline({ values, color }: { values: number[]; color: string }): JSX.Element | null {
  if (values.length < 2) return null;
  const w = 120;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={w}
        cy={h - ((values[values.length - 1]! - min) / range) * h}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}

function DeltaIcon({ value }: { value: number | null }): JSX.Element {
  if (value === null || value === 0) return <Minus size={11} />;
  return value > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />;
}

function formatDelta(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString()}`;
}

function deltaClass(value: number | null): string {
  if (value === null || value === 0) return "text-ink-3";
  return value > 0 ? "text-sage-deep" : "text-rose-deep";
}

export function PlatformCards({ snapshots, today }: Props): JSX.Element {
  const stats = useMemo(
    () => PLATFORMS.map((p) => ({ platform: p, stats: statsFor(snapshots, p, today) })),
    [snapshots, today],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map(({ platform, stats: s }) => {
        const color = SOCIAL_PLATFORM_COLORS[platform];
        return (
          <div
            key={platform}
            className="card relative"
            style={{ borderLeftColor: color, borderLeftWidth: 3 }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="eyebrow">{SOCIAL_PLATFORM_LABELS[platform]}</div>
              {s.spark.length >= 2 && <Sparkline values={s.spark} color={color} />}
            </div>
            <div className="font-serif text-[28px] text-ink leading-none mb-1.5">
              {s.current === null ? "—" : s.current.toLocaleString()}
            </div>
            <div className="text-[12px] text-ink-3 mb-3">followers</div>
            <div className="flex gap-5 text-[13px]">
              <div>
                <div className="eyebrow">7d</div>
                <div
                  className={`font-semibold mt-0.5 flex items-center gap-1 ${deltaClass(s.delta7)}`}
                >
                  <DeltaIcon value={s.delta7} />
                  {formatDelta(s.delta7)}
                </div>
              </div>
              <div>
                <div className="eyebrow">30d</div>
                <div
                  className={`font-semibold mt-0.5 flex items-center gap-1 ${deltaClass(s.delta30)}`}
                >
                  <DeltaIcon value={s.delta30} />
                  {formatDelta(s.delta30)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

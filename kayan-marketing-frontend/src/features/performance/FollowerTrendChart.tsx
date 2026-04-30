import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_COLORS,
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
} from "../../constants/social-platform";
import type { PerformanceSnapshot } from "../../types/performance";

interface Props {
  snapshots: PerformanceSnapshot[];
}

interface ChartRow {
  date: string;
  tiktok: number | null;
  instagram: number | null;
  snapchat: number | null;
}

const PLATFORMS: readonly SocialPlatform[] = [
  SOCIAL_PLATFORMS.TIKTOK,
  SOCIAL_PLATFORMS.INSTAGRAM,
  SOCIAL_PLATFORMS.SNAPCHAT,
];

export function FollowerTrendChart({ snapshots }: Props): JSX.Element {
  const data = useMemo<ChartRow[]>(() => {
    const byDate = new Map<string, ChartRow>();
    for (const s of snapshots) {
      const row =
        byDate.get(s.snapshotDate) ??
        ({ date: s.snapshotDate, tiktok: null, instagram: null, snapchat: null } satisfies ChartRow);
      row[s.platform] = s.followers;
      byDate.set(s.snapshotDate, row);
    }
    return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [snapshots]);

  if (data.length === 0) {
    return (
      <div className="text-[13px] text-ink-3 py-12 text-center">
        No snapshots in this window. Log one to start trending.
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--c-line)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => (typeof v === "string" ? format(parseISO(v), "MMM d") : "")}
            stroke="var(--c-ink-3)"
            tick={{ fontSize: 11, fill: "var(--c-ink-3)" }}
          />
          <YAxis stroke="var(--c-ink-3)" tick={{ fontSize: 11, fill: "var(--c-ink-3)" }} />
          <Tooltip
            contentStyle={{
              background: "var(--c-paper)",
              border: "1px solid var(--c-line)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--c-ink)",
            }}
            labelStyle={{ color: "var(--c-ink)" }}
            labelFormatter={(label) =>
              typeof label === "string" ? format(parseISO(label), "MMM d, yyyy") : ""
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {PLATFORMS.map((p) => (
            <Line
              key={p}
              type="monotone"
              dataKey={p}
              name={SOCIAL_PLATFORM_LABELS[p]}
              stroke={SOCIAL_PLATFORM_COLORS[p]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

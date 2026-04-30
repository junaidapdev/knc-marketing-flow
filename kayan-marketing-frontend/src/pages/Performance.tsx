import { useMemo, useState } from "react";
import { format, subDays, formatDistanceToNow } from "date-fns";
import { Plus, RefreshCw } from "lucide-react";
import { useCurrentBrand } from "../hooks/use-current-brand";
import { useBrand } from "../features/brand/hooks/use-brand";
import { usePerformanceSnapshots } from "../features/performance/hooks/use-performance-snapshots";
import { useTopPosts } from "../features/performance/hooks/use-top-posts";
import { useIngestPerformance } from "../features/performance/hooks/use-ingest-performance";
import { PlatformCards } from "../features/performance/PlatformCards";
import { FollowerTrendChart } from "../features/performance/FollowerTrendChart";
import { TopPostsGrid } from "../features/performance/TopPostsGrid";
import { PostDetailDrawer } from "../features/performance/PostDetailDrawer";
import { LogSnapshotModal } from "../features/performance/LogSnapshotModal";
import { LogTopPostModal } from "../features/performance/LogTopPostModal";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "../constants/social-platform";
import type { TopPost } from "../types/performance";
import { logger } from "../utils/logger";

const RANGE_OPTIONS = [30, 60, 90] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];

// Sort options for the top-posts grid. The label is what the marketer sees;
// the API value (`apiSort`) is what we send to the top-posts Edge Function.
const SORT_OPTIONS = [
  { key: "plays", label: "Plays", apiSort: "plays" as const },
  { key: "likes", label: "Likes", apiSort: "likes" as const },
  { key: "engagement", label: "Engagement", apiSort: "engagement_rate" as const },
  { key: "recent", label: "Most recent", apiSort: "post_date" as const },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

type PlatformFilter = "all" | SocialPlatform;

export default function PerformancePage(): JSX.Element {
  const { brandId } = useCurrentBrand();
  const today = format(new Date(), "yyyy-MM-dd");
  const [range, setRange] = useState<RangeOption>(30);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [topPostOpen, setTopPostOpen] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [ingestErrors, setIngestErrors] = useState<{ platform: string; message: string }[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("plays");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [openPost, setOpenPost] = useState<TopPost | null>(null);

  const brand = useBrand(brandId);
  const ingest = useIngestPerformance();

  const onRefresh = async (): Promise<void> => {
    setIngestStatus(null);
    setIngestErrors([]);
    try {
      const result = await ingest.mutateAsync();
      const parts: string[] = [];
      const errors: { platform: string; message: string }[] = [];
      for (const s of result.summaries) {
        const tag = s.platform === "instagram" ? "IG" : "TT";
        if (s.error) {
          errors.push({ platform: tag, message: s.error });
          parts.push(`${tag}: error`);
        } else {
          const f = s.followers != null ? `${s.followers.toLocaleString()} followers` : "no followers";
          parts.push(`${tag}: ${f}, ${s.postsIngested} posts`);
        }
      }
      setIngestStatus(parts.join(" · "));
      setIngestErrors(errors);
    } catch (err) {
      logger.error("ingest failed", { err: String(err) });
      setIngestStatus(err instanceof Error ? err.message : "Refresh failed.");
    }
  };

  const lastSyncLabel = brand.data?.lastApifySyncAt
    ? `Last synced ${formatDistanceToNow(new Date(brand.data.lastApifySyncAt), { addSuffix: true })}`
    : "Never synced";

  const fromForChart = useMemo(
    () => format(subDays(new Date(), range), "yyyy-MM-dd"),
    [range],
  );
  const cardsFrom = useMemo(() => format(subDays(new Date(), 60), "yyyy-MM-dd"), []);

  const chartSnapshots = usePerformanceSnapshots({
    brandId,
    from: fromForChart,
    to: today,
  });
  const cardSnapshots = usePerformanceSnapshots({
    brandId,
    from: cardsFrom,
    to: today,
  });
  const apiSort = SORT_OPTIONS.find((o) => o.key === sortKey)?.apiSort ?? "plays";
  const posts = useTopPosts({
    brandId,
    sort: apiSort,
    platform: platformFilter === "all" ? undefined : platformFilter,
  });

  return (
    <div className="px-9 pt-8 pb-12 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h-greeting">
            Performance <em>pulse</em>
          </h1>
          <p className="text-[14px] text-ink-2 mt-1.5">
            Weekly snapshots, follower growth, and the posts that punched above their weight.
          </p>
          <p className="text-[12px] text-ink-3 mt-1">
            {lastSyncLabel}
            {ingestStatus && <span className="ml-2 text-ink-2">· {ingestStatus}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={ingest.isPending}
            className="btn btn-primary disabled:opacity-50"
            title="Pull the latest follower count + recent posts from Instagram and TikTok via Apify."
          >
            <RefreshCw size={14} className={ingest.isPending ? "animate-spin" : ""} />
            {ingest.isPending ? "Refreshing…" : "Refresh from Apify"}
          </button>
          <button onClick={() => setSnapshotOpen(true)} className="btn btn-ghost">
            <Plus size={14} />
            Log Snapshot
          </button>
          <button onClick={() => setTopPostOpen(true)} className="btn btn-ghost">
            <Plus size={14} />
            Log Top Post
          </button>
        </div>
      </header>

      {ingestErrors.length > 0 && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-3 text-[12.5px] space-y-1">
          <div className="font-semibold">Apify refresh returned errors:</div>
          {ingestErrors.map((e) => (
            <div key={e.platform} className="font-mono text-[11.5px] break-all">
              <span className="font-semibold">{e.platform}:</span> {e.message}
            </div>
          ))}
        </div>
      )}

      <PlatformCards snapshots={cardSnapshots.data ?? []} today={today} />

      <section className="card">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="h-card">Follower trend</h2>
          <div className="tab-group">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setRange(opt)}
                className={`tab ${range === opt ? "tab-active" : ""}`}
              >
                {opt}D
              </button>
            ))}
          </div>
        </div>
        <FollowerTrendChart snapshots={chartSnapshots.data ?? []} />
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="h-card">Top posts</h2>
            <span className="text-[12px] text-ink-3">
              {posts.data ? `${posts.data.length} posts` : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Platform filter chips */}
            <div className="flex items-center gap-1">
              {(
                [
                  { key: "all" as const, label: "All" },
                  { key: SOCIAL_PLATFORMS.TIKTOK, label: "TikTok" },
                  { key: SOCIAL_PLATFORMS.INSTAGRAM, label: "Instagram" },
                ] satisfies { key: PlatformFilter; label: string }[]
              ).map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPlatformFilter(p.key)}
                  className={`text-[11.5px] px-2.5 py-1 rounded-full font-medium transition ${
                    platformFilter === p.key
                      ? "bg-obsidian text-yellow"
                      : "bg-cream-2 text-ink-2 hover:bg-cream"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Sort tabs */}
            <div className="tab-group">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className={`tab ${sortKey === opt.key ? "tab-active" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <TopPostsGrid posts={posts.data ?? []} onPostClick={(p) => setOpenPost(p)} />
      </section>

      <PostDetailDrawer post={openPost} onClose={() => setOpenPost(null)} />

      <LogSnapshotModal
        brandId={brandId}
        isOpen={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
      />
      <LogTopPostModal
        brandId={brandId}
        isOpen={topPostOpen}
        onClose={() => setTopPostOpen(false)}
      />
    </div>
  );
}

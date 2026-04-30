import { useMemo, useState } from "react";
import { ExternalLink, Trash2, Trophy, Heart, MessageCircle, Eye, Share2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_COLORS,
  type SocialPlatform,
} from "../../constants/social-platform";
import type { TopPost } from "../../types/performance";
import { useDeleteTopPost } from "./hooks/use-top-posts";
import { logger } from "../../utils/logger";

interface Props {
  posts: TopPost[];
  onPostClick: (post: TopPost) => void;
}

function formatNum(value: number | null): string {
  if (value === null) return "—";
  // Compact for grid badges: 12.3k, 1.2M
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1_000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString();
}

// Color the engagement-rate pill so a marketer can scan the grid and instantly
// spot what punched above its weight without comparing percentages mentally.
function engagementClass(rate: number | null): string {
  if (rate === null) return "bg-cream-2 text-ink-3";
  if (rate >= 5) return "bg-sage/30 text-sage-deep";
  if (rate >= 2) return "bg-yellow-bg text-ink-2";
  return "bg-cream-2 text-ink-3";
}

export function TopPostsGrid({ posts, onPostClick }: Props): JSX.Element {
  const remove = useDeleteTopPost();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // The single best post (by plays) gets pinned and stamped — the marketer
  // wants this answer in the first half-second of looking at the page.
  const best = useMemo(() => {
    if (posts.length === 0) return null;
    return posts.reduce((acc, p) => ((p.plays ?? 0) > (acc.plays ?? 0) ? p : acc), posts[0]!);
  }, [posts]);
  const rest = useMemo(() => posts.filter((p) => p.id !== best?.id), [posts, best]);

  const onDelete = async (e: React.MouseEvent, id: string): Promise<void> => {
    e.stopPropagation();
    const ok = window.confirm("Remove this post from the leaderboard?");
    if (!ok) return;
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      logger.error("delete top post failed", { err: String(err) });
    }
  };

  if (posts.length === 0) {
    return (
      <div className="text-[13px] text-ink-3 py-12 text-center">
        No top posts yet. Click "Refresh from Apify" above to pull recent posts.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {best && <BestPerformerCard post={best} onClick={() => onPostClick(best)} />}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {rest.map((p) => (
          <button
            key={p.id}
            onClick={() => onPostClick(p)}
            onMouseEnter={() => setHoveredId(p.id)}
            onMouseLeave={() => setHoveredId(null)}
            className="group relative text-left bg-paper border border-line rounded-md overflow-hidden hover:border-ink-3 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-yellow"
          >
            {/* Thumbnail or coloured fallback bar */}
            <div className="relative aspect-square bg-cream-2 overflow-hidden">
              {p.thumbnailUrl ? (
                <img
                  src={p.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Apify thumbnails sometimes 403 from Instagram CDN — swap
                    // to the platform colour bar so the grid still looks tidy.
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{
                    background: `linear-gradient(135deg, ${SOCIAL_PLATFORM_COLORS[p.platform as SocialPlatform]}33, ${SOCIAL_PLATFORM_COLORS[p.platform as SocialPlatform]}11)`,
                  }}
                />
              )}
              {/* Platform pill */}
              <div className="absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-obsidian/85 text-yellow uppercase tracking-wider">
                {SOCIAL_PLATFORM_LABELS[p.platform as SocialPlatform]}
              </div>
              {/* Engagement badge */}
              {p.engagementRate !== null && (
                <div
                  className={`absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${engagementClass(p.engagementRate)}`}
                >
                  {p.engagementRate.toFixed(1)}%
                </div>
              )}
              {/* Hover overlay with quick actions */}
              <div
                className={`absolute inset-0 bg-obsidian/55 flex items-center justify-center gap-2 transition-opacity ${hoveredId === p.id ? "opacity-100" : "opacity-0"}`}
              >
                {p.postUrl && (
                  <a
                    href={p.postUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(e) => e.stopPropagation()}
                    className="grid place-items-center w-9 h-9 rounded-full bg-paper text-ink hover:bg-yellow"
                    aria-label="Open original post"
                    title="Open original post"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
                <button
                  onClick={(e) => onDelete(e, p.id)}
                  disabled={remove.isPending}
                  className="grid place-items-center w-9 h-9 rounded-full bg-paper text-rose-deep hover:bg-rose/40 disabled:opacity-50"
                  aria-label="Delete"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="px-2.5 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-ink-3">
                <span>{format(parseISO(p.postDate), "MMM d")}</span>
              </div>
              <div className="flex items-center gap-2.5 text-[11.5px] text-ink-2 font-medium">
                <span className="flex items-center gap-1" title="Plays / views">
                  <Eye size={11} className="text-ink-3" />
                  {formatNum(p.plays)}
                </span>
                <span className="flex items-center gap-1" title="Likes">
                  <Heart size={11} className="text-ink-3" />
                  {formatNum(p.likes)}
                </span>
                <span className="flex items-center gap-1" title="Comments">
                  <MessageCircle size={11} className="text-ink-3" />
                  {formatNum(p.comments)}
                </span>
              </div>
              {p.captionSnippet && (
                <div className="text-[11.5px] text-ink-3 line-clamp-2 leading-snug" dir="auto">
                  {p.captionSnippet}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface BestProps {
  post: TopPost;
  onClick: () => void;
}

function BestPerformerCard({ post, onClick }: BestProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="group flex items-stretch gap-4 w-full text-left bg-yellow-bg border border-yellow/40 rounded-md p-2.5 hover:border-yellow transition focus:outline-none focus:ring-2 focus:ring-yellow"
    >
      <div className="relative w-32 h-32 flex-shrink-0 rounded-md overflow-hidden bg-cream-2">
        {post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${SOCIAL_PLATFORM_COLORS[post.platform as SocialPlatform]}33, ${SOCIAL_PLATFORM_COLORS[post.platform as SocialPlatform]}11)`,
            }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0 py-1 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-obsidian text-yellow uppercase tracking-wider">
            <Trophy size={10} />
            Top performer
          </span>
          <span className="text-[10.5px] text-ink-3 uppercase tracking-wider">
            {SOCIAL_PLATFORM_LABELS[post.platform as SocialPlatform]} ·{" "}
            {format(parseISO(post.postDate), "MMM d, yyyy")}
          </span>
        </div>
        {post.captionSnippet && (
          <div
            className="text-[13px] text-ink leading-snug line-clamp-2 mb-2"
            dir="auto"
          >
            {post.captionSnippet}
          </div>
        )}
        <div className="flex items-center gap-4 text-[13px] text-ink-2 font-semibold mt-auto">
          <span className="flex items-center gap-1.5">
            <Eye size={13} className="text-ink-3" />
            {formatNum(post.plays)}
          </span>
          <span className="flex items-center gap-1.5">
            <Heart size={13} className="text-ink-3" />
            {formatNum(post.likes)}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle size={13} className="text-ink-3" />
            {formatNum(post.comments)}
          </span>
          {post.shares !== null && (
            <span className="flex items-center gap-1.5">
              <Share2 size={13} className="text-ink-3" />
              {formatNum(post.shares)}
            </span>
          )}
          {post.engagementRate !== null && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${engagementClass(post.engagementRate)}`}>
              {post.engagementRate.toFixed(1)}% engagement
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

import { ExternalLink, Trash2 } from "lucide-react";
import { SOCIAL_PLATFORM_LABELS, type SocialPlatform } from "../../constants/social-platform";
import type { TopPost } from "../../types/performance";
import { useDeleteTopPost } from "./hooks/use-top-posts";
import { logger } from "../../utils/logger";

interface Props {
  posts: TopPost[];
}

function formatNum(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString();
}

export function TopPostsTable({ posts }: Props): JSX.Element {
  const remove = useDeleteTopPost();

  const onDelete = async (id: string): Promise<void> => {
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
      <div className="text-[13px] text-ink-3 py-8 text-center">No top posts logged yet.</div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
      <table className="w-full text-[13px] min-w-[640px]">
        <thead className="text-left">
          <tr>
            <th className="px-3 py-3 eyebrow">Platform</th>
            <th className="px-3 py-3 eyebrow">Date</th>
            <th className="px-3 py-3 eyebrow">Caption</th>
            <th className="px-3 py-3 eyebrow text-right">Plays</th>
            <th className="px-3 py-3 eyebrow text-right">Likes</th>
            <th className="px-3 py-3 eyebrow text-right">Eng %</th>
            <th className="px-3 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} className="border-t border-line">
              <td className="px-3 py-3">{SOCIAL_PLATFORM_LABELS[p.platform as SocialPlatform]}</td>
              <td className="px-3 py-3 text-ink-2">{p.postDate}</td>
              <td className="px-3 py-3 max-w-xs truncate" title={p.captionSnippet ?? undefined}>
                {p.captionSnippet ?? "—"}
              </td>
              <td className="px-3 py-3 text-right font-semibold">{formatNum(p.plays)}</td>
              <td className="px-3 py-3 text-right">{formatNum(p.likes)}</td>
              <td className="px-3 py-3 text-right">
                {p.engagementRate === null ? "—" : `${p.engagementRate.toFixed(1)}%`}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center justify-end gap-2">
                  {p.postUrl && (
                    <a
                      href={p.postUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="Open post"
                      className="text-ink-3 hover:text-ink"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => onDelete(p.id)}
                    disabled={remove.isPending}
                    aria-label="Delete"
                    className="text-rose-deep hover:brightness-90 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

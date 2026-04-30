import { useEffect } from "react";
import { X, ExternalLink, Sparkles, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_COLORS,
  type SocialPlatform,
} from "../../constants/social-platform";
import type { TopPost } from "../../types/performance";
import { useAIStore } from "../../stores/ai-store";
import { PROMPT_TEMPLATES } from "../../constants/ai";
import { isAIEnabled } from "../../config/env";

interface Props {
  post: TopPost | null;
  onClose: () => void;
}

function formatNum(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString();
}

// Build the prompt that "Generate riff" sends to the AI panel. We hand the
// AI the full caption + key metrics so it can reason about WHY the post
// performed and produce a Kayan-flavoured riff via the trend_brief template.
function buildRiffPrompt(post: TopPost): string {
  const platform = SOCIAL_PLATFORM_LABELS[post.platform as SocialPlatform];
  const lines: string[] = [];
  lines.push(
    `This ${platform} post performed well for us. Analyze why it worked and propose 3 fresh Kayan-style riffs that capture the same hook energy without copying it.`,
  );
  lines.push("");
  lines.push(`Posted: ${post.postDate}`);
  if (post.plays != null) lines.push(`Plays: ${post.plays.toLocaleString()}`);
  if (post.likes != null) lines.push(`Likes: ${post.likes.toLocaleString()}`);
  if (post.comments != null) lines.push(`Comments: ${post.comments.toLocaleString()}`);
  if (post.shares != null) lines.push(`Shares: ${post.shares.toLocaleString()}`);
  if (post.engagementRate != null) {
    lines.push(`Engagement rate: ${post.engagementRate.toFixed(2)}%`);
  }
  if (post.captionSnippet) {
    lines.push("");
    lines.push("Caption:");
    lines.push(post.captionSnippet);
  }
  return lines.join("\n");
}

export function PostDetailDrawer({ post, onClose }: Props): JSX.Element | null {
  const triggerInlineGenerate = useAIStore((s) => s.triggerInlineGenerate);

  // Close on Escape — drawer pattern.
  useEffect(() => {
    if (!post) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [post, onClose]);

  if (!post) return null;

  const onGenerateRiff = (): void => {
    triggerInlineGenerate(PROMPT_TEMPLATES.TREND_BRIEF, buildRiffPrompt(post));
    onClose();
  };

  const platformColor = SOCIAL_PLATFORM_COLORS[post.platform as SocialPlatform];

  return (
    <>
      {/* Scrim */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-30 bg-obsidian/40 cursor-default"
      />
      {/* Drawer */}
      <aside className="fixed top-4 right-4 bottom-4 w-full sm:w-[420px] bg-paper border border-line rounded-lg shadow-lg z-40 flex flex-col text-ink overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3.5 border-b border-line">
          <div className="flex items-center gap-2">
            <span
              className="text-[10.5px] font-bold px-2 py-0.5 rounded-full text-obsidian uppercase tracking-wider"
              style={{ backgroundColor: platformColor }}
            >
              {SOCIAL_PLATFORM_LABELS[post.platform as SocialPlatform]}
            </span>
            <span className="text-[12px] text-ink-3">
              {format(parseISO(post.postDate), "MMM d, yyyy")}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid place-items-center w-8 h-8 rounded-md text-ink-3 hover:bg-cream-2 hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* Cover */}
          {post.thumbnailUrl && (
            <div className="aspect-video bg-cream-2 overflow-hidden border-b border-line">
              <img
                src={post.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget.parentElement as HTMLDivElement).style.display = "none";
                }}
              />
            </div>
          )}

          {/* Metric grid */}
          <div className="grid grid-cols-2 gap-2 p-4 border-b border-line">
            <Metric icon={<Eye size={13} />} label="Plays" value={formatNum(post.plays)} />
            <Metric icon={<Heart size={13} />} label="Likes" value={formatNum(post.likes)} />
            <Metric
              icon={<MessageCircle size={13} />}
              label="Comments"
              value={formatNum(post.comments)}
            />
            <Metric icon={<Share2 size={13} />} label="Shares" value={formatNum(post.shares)} />
            {post.engagementRate !== null && (
              <div className="col-span-2 rounded-md bg-yellow-bg border border-yellow/40 px-3 py-2.5">
                <div className="eyebrow">Engagement rate</div>
                <div className="font-serif text-[20px] text-ink mt-0.5 leading-none">
                  {post.engagementRate.toFixed(2)}%
                </div>
              </div>
            )}
          </div>

          {/* Caption */}
          {post.captionSnippet && (
            <div className="p-4 border-b border-line">
              <div className="eyebrow mb-2">Caption</div>
              <div
                className="text-[13.5px] text-ink leading-relaxed whitespace-pre-wrap"
                dir="auto"
              >
                {post.captionSnippet}
              </div>
            </div>
          )}

          {/* Open original */}
          {post.postUrl && (
            <div className="p-4 border-b border-line">
              <a
                href={post.postUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 text-[13px] text-ink-2 hover:text-ink underline underline-offset-2"
              >
                <ExternalLink size={13} />
                Open original post
              </a>
            </div>
          )}
        </div>

        {/* Sticky footer with the headline action — gated by the AI feature
            flag so V1 ships without exposing AI riffing. */}
        {isAIEnabled && (
          <footer className="border-t border-line p-3">
            <button
              onClick={onGenerateRiff}
              className="btn btn-primary w-full justify-center text-[13px]"
              title="Send this post into the AI panel as a Trend Brief — get 3 Kayan-style riffs."
            >
              <Sparkles size={14} />
              Generate riff in AI panel
            </button>
            <p className="text-[11px] text-ink-3 mt-1.5 text-center">
              Pipes caption + metrics into the AI as a Trend Brief.
            </p>
          </footer>
        )}
      </aside>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="rounded-md border border-line px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-ink-3">
        {icon}
        <span className="eyebrow">{label}</span>
      </div>
      <div className="font-serif text-[20px] text-ink mt-1 leading-none">{value}</div>
    </div>
  );
}

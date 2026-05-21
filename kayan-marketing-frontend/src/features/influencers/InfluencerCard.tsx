import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, Check, Copy } from "lucide-react";
import { QuickBookPopover } from "./QuickBookPopover";
import { splitDisplayName } from "./utils/display-name";
import { toWaUrl } from "./utils/whatsapp";
import {
  INFLUENCER_STATUS_LABELS,
  type InfluencerStatus,
} from "../../constants/influencer-status";
import { INFLUENCER_NICHE_TAG_LABELS } from "../../constants/influencer-niche-tags";
import {
  classifyTier,
  highestFollowerCount,
  INFLUENCER_TIER_LABELS,
} from "../../constants/influencer-tiers";
import {
  getInfluencerPlatforms,
  type InfluencerPlatform,
} from "../../constants/influencer-platforms";
import type {
  InfluencerReliability,
  InfluencerWithReliability,
} from "../../types/influencer";
import {
  InstagramIcon,
  SnapchatIcon,
  TikTokIcon,
  WhatsAppIcon,
} from "./icons";

interface InfluencerCardProps {
  influencer: InfluencerWithReliability;
  onView: () => void;
  // Fires after the QuickBookPopover successfully creates a calendar
  // entry. The page (Influencers.tsx) uses this to raise the undo toast.
  // Optional so the card stays usable in any future read-only context.
  onBooked?: (args: { entryId: string; message: string }) => void;
}

function formatCompact(value: number): string {
  if (value <= 0) return "0";
  if (value < 1000) return value.toString();
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

type ReliabilityState = "reliable" | "mid" | "risky";

// Composite = min of post / tag / on-time rates (matches the rule the
// list-filter chips already use). Returns null when any rate is null,
// which the card treats as "hide the pill" per the chosen UX.
function classifyReliability(
  reliability: InfluencerReliability | null,
): ReliabilityState | null {
  if (!reliability) return null;
  if (
    reliability.postRate === null ||
    reliability.tagRate === null ||
    reliability.onTimeRate === null
  ) {
    return null;
  }
  const composite = Math.min(
    reliability.postRate,
    reliability.tagRate,
    reliability.onTimeRate,
  );
  if (composite >= 80) return "reliable";
  if (composite >= 50) return "mid";
  return "risky";
}

export function InfluencerCard({
  influencer,
  onView,
  onBooked,
}: InfluencerCardProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const bookButtonRef = useRef<HTMLButtonElement>(null);

  const { primaryName, secondaryName } = splitDisplayName(influencer.displayName);
  const followers = highestFollowerCount(influencer);
  const tier = classifyTier(followers);
  const platforms = getInfluencerPlatforms(influencer);
  const reliabilityState = classifyReliability(influencer.reliability);

  const waUrl = useMemo(() => toWaUrl(influencer.whatsapp), [influencer.whatsapp]);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(influencer.whatsapp);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browser or permission denied — silently no-op. The
      // arrow button is still available for the user to act on.
    }
  };

  // Whole-card click opens the detail panel. Action controls (WhatsApp /
  // copy / quick-book / arrow) and the portaled quick-book popover handle
  // their own clicks, so anything originating from a button or link is
  // ignored here (the arrow button still calls onView itself).
  const handleCardOpen = (event: React.MouseEvent<HTMLElement>): void => {
    if ((event.target as HTMLElement).closest("button, a")) return;
    onView();
  };

  return (
    <article
      onClick={handleCardOpen}
      className="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Header: name (English + Arabic) + tier */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[15.5px] font-semibold text-ink leading-tight truncate">
            {primaryName}
          </h3>
          {secondaryName && (
            <p
              className="text-[11.5px] text-ink-3 mt-0.5 truncate"
              dir="rtl"
              lang="ar"
            >
              {secondaryName}
            </p>
          )}
        </div>
        {tier && (
          <span className="chip chip-influencer !text-[10px] tracking-wide uppercase flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-lavender-deep" />
            {INFLUENCER_TIER_LABELS[tier]}
          </span>
        )}
      </div>

      {/* City · WhatsApp */}
      <p className="text-[11.5px] text-ink-3 -mt-1">
        {influencer.city && <span>{influencer.city} · </span>}
        <span className="tabular-nums">{influencer.whatsapp}</span>
      </p>

      {/* Stats box: followers · rate · platforms */}
      <div className="bg-cream-2/60 rounded-[14px] px-3 py-2.5 flex items-center gap-3">
        <div className="min-w-0">
          <div className="text-[18px] font-semibold text-ink tabular-nums leading-tight">
            {formatCompact(followers)}
          </div>
          <div className="eyebrow !text-[9px] text-ink-3 mt-0.5">FOLLOWERS</div>
        </div>
        <div className="w-px self-stretch bg-line" />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink leading-tight tabular-nums">
            {influencer.standardRate !== null ? (
              <>
                {influencer.standardRate.toLocaleString()}{" "}
                <span className="text-[10px] text-ink-3 font-normal">SAR</span>
              </>
            ) : (
              <span className="text-ink-3 font-normal text-[13px]">Not set</span>
            )}
          </div>
          <div className="eyebrow !text-[9px] text-ink-3 mt-0.5">PER POST</div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          {platforms.length > 0 && (
            <div className="flex -space-x-1.5">
              {platforms.map((platform) => (
                <PlatformBadge key={platform} platform={platform} />
              ))}
            </div>
          )}
          <span className="eyebrow !text-[9px] text-ink-3">
            {platforms.length} {platforms.length === 1 ? "PLATFORM" : "PLATFORMS"}
          </span>
        </div>
      </div>

      {/* Status + reliability pills */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <StatusPill status={influencer.status} />
        {reliabilityState && <ReliabilityPill state={reliabilityState} />}
      </div>

      {/* Niche tags */}
      {influencer.nicheTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {influencer.nicheTags.slice(0, 3).map((tag) => (
            <span key={tag} className="chip chip-default !text-[11px]">
              {INFLUENCER_NICHE_TAG_LABELS[tag]}
            </span>
          ))}
          {influencer.nicheTags.length > 3 && (
            <span className="chip chip-default !text-[11px]">
              +{influencer.nicheTags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Actions: WhatsApp (chat) · Copy number · View details */}
      <div className="flex gap-2 mt-auto pt-1">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1FBA5A] text-white rounded-full py-2.5 text-[13px] font-semibold transition"
          aria-label={`Open WhatsApp chat with ${primaryName}`}
        >
          <WhatsAppIcon className="w-4 h-4" />
          WhatsApp
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="w-[38px] h-[38px] inline-grid place-items-center bg-cream-2 rounded-full text-ink-2 hover:bg-yellow-soft hover:text-ink transition"
          aria-label={copied ? "Copied" : "Copy WhatsApp number"}
          title={copied ? "Copied!" : "Copy number"}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
        <button
          ref={bookButtonRef}
          type="button"
          onClick={() => setBookingOpen((open) => !open)}
          className={`w-[38px] h-[38px] inline-grid place-items-center rounded-full transition ${
            bookingOpen
              ? "bg-obsidian text-yellow"
              : "bg-cream-2 text-ink-2 hover:bg-yellow-soft hover:text-ink"
          }`}
          aria-label={`Quick book ${primaryName}`}
          aria-expanded={bookingOpen}
          title="Quick book"
        >
          <CalendarDays size={16} />
        </button>
        <button
          type="button"
          onClick={onView}
          className="w-[38px] h-[38px] inline-grid place-items-center bg-cream-2 rounded-full text-ink-2 hover:bg-yellow-soft hover:text-ink transition"
          aria-label={`View ${primaryName} details`}
          title="View details"
        >
          <ArrowUpRight size={16} />
        </button>
      </div>

      {bookingOpen && (
        <QuickBookPopover
          influencer={influencer}
          primaryName={primaryName}
          anchorEl={bookButtonRef.current}
          onClose={() => setBookingOpen(false)}
          onBooked={(args) => {
            onBooked?.(args);
          }}
        />
      )}
    </article>
  );
}

// Status pill with a leading colored dot. Pulled out so future status
// values land in one place.
function StatusPill({ status }: { status: InfluencerStatus }): JSX.Element {
  const config = (() => {
    switch (status) {
      case "active":
        return { bg: "bg-sage/60", text: "text-[#2C5530]", dot: "bg-sage-deep" };
      case "paused":
        return { bg: "bg-peach/60", text: "text-[#7A3D1F]", dot: "bg-peach-deep" };
      case "blacklisted":
        return { bg: "bg-rose/60", text: "text-[#6E2A35]", dot: "bg-rose-deep" };
      default:
        return { bg: "bg-cream-2", text: "text-ink-2", dot: "bg-ink-3" };
    }
  })();
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${config.bg} ${config.text} rounded-full px-2.5 py-1 text-[11px] font-medium`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {INFLUENCER_STATUS_LABELS[status]}
    </span>
  );
}

// Reliability pill — only rendered when a composite is available.
// Visual: outlined ring (vs. status's filled dot) so the two pills are
// distinguishable side-by-side.
function ReliabilityPill({ state }: { state: ReliabilityState }): JSX.Element {
  const config = (() => {
    switch (state) {
      case "reliable":
        return {
          bg: "bg-sage/60",
          text: "text-[#2C5530]",
          ring: "border-sage-deep",
          label: "Reliable",
        };
      case "mid":
        return {
          bg: "bg-butter",
          text: "text-[#6B4A0F]",
          ring: "border-[#B88A2A]",
          label: "Mid",
        };
      case "risky":
        return {
          bg: "bg-rose/60",
          text: "text-[#6E2A35]",
          ring: "border-rose-deep",
          label: "Risky",
        };
    }
  })();
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${config.bg} ${config.text} rounded-full px-2.5 py-1 text-[11px] font-medium`}
    >
      <span className={`w-2 h-2 rounded-full border ${config.ring} bg-transparent`} />
      {config.label}
    </span>
  );
}

function PlatformBadge({
  platform,
}: {
  platform: InfluencerPlatform;
}): JSX.Element {
  if (platform === "tiktok") {
    return (
      <span
        className="w-6 h-6 rounded-full bg-obsidian grid place-items-center border-2 border-cream"
        title="TikTok"
      >
        <TikTokIcon className="w-3 h-3 text-white" />
      </span>
    );
  }
  if (platform === "instagram") {
    return (
      <span
        className="w-6 h-6 rounded-full grid place-items-center border-2 border-cream"
        style={{
          background:
            "linear-gradient(45deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
        }}
        title="Instagram"
      >
        <InstagramIcon className="w-3 h-3 text-white" />
      </span>
    );
  }
  return (
    <span
      className="w-6 h-6 rounded-full bg-[#FFFC00] grid place-items-center border-2 border-cream"
      title="Snapchat"
    >
      <SnapchatIcon className="w-3 h-3 text-obsidian" />
    </span>
  );
}

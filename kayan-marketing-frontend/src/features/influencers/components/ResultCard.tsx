import { useState } from "react";
import { Bookmark, BookmarkCheck, User } from "lucide-react";
import { PLATFORM_LABELS } from "../../../constants/influencer";
import type { CreatorResult } from "../../../types/influencer";
import { formatFollowerCount, formatEngagementRate } from "../utils/format";

// Per-platform chip palette — reuses the project's existing color-named
// utility classes from index.css so the cards visually rhyme with the
// Performance page's platform pills.
const PLATFORM_CHIP: Record<CreatorResult["platform"], string> = {
  tiktok: "bg-[#1C1C1C] text-white",
  instagram: "bg-peach text-[#7A3520]",
  youtube: "bg-rose text-[#6E2A35]",
};

// Score chip color thresholds, per Chunk 5 spec:
//   ≥80 → emerald (sage), ≥60 → yellow, else → neutral.
function scoreChipClass(score: number | null): string {
  if (score === null) return "bg-cream-2 text-ink-3";
  if (score >= 80) return "bg-sage text-[#2C5530]";
  if (score >= 60) return "bg-yellow text-obsidian";
  return "bg-cream-2 text-ink-2";
}

interface Props {
  creator: CreatorResult;
}

export function ResultCard({ creator }: Props): JSX.Element {
  // Chunk 2: Save is a no-op. Local state flips the icon so the affordance
  // is visible during the design pass; persistence lands in Chunk 7.
  const [isSavedLocal, setIsSavedLocal] = useState(false);

  const score = creator.fitScore;
  const rationale = creator.fitRationale;
  const scoreLabel = score === null ? "—" : String(score);

  return (
    <article className="card flex flex-col gap-3">
      <header className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-cream-2 grid place-items-center text-ink-3 flex-shrink-0 overflow-hidden">
          {creator.avatarUrl ? (
            <img
              src={creator.avatarUrl}
              alt={creator.displayName ?? creator.handle}
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={20} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-ink truncate">
              @{creator.handle}
            </span>
            <span
              className={`chip ${PLATFORM_CHIP[creator.platform]}`}
              aria-label={`Platform: ${PLATFORM_LABELS[creator.platform]}`}
            >
              {PLATFORM_LABELS[creator.platform]}
            </span>
          </div>
          {creator.displayName && (
            <div className="text-[12.5px] text-ink-2 truncate mt-0.5">
              {creator.displayName}
            </div>
          )}
          {(creator.city ?? creator.country) && (
            <div className="text-[11.5px] text-ink-3 mt-0.5">
              {[creator.city, creator.country?.toUpperCase()]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}
        </div>
      </header>

      <div className="flex items-center gap-4 text-[12.5px]">
        <div className="flex flex-col">
          <span className="text-ink-3 text-[11px]">Followers</span>
          <span className="text-ink font-semibold">
            {formatFollowerCount(creator.followerCount)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-ink-3 text-[11px]">Engagement</span>
          <span className="text-ink font-semibold">
            {formatEngagementRate(creator.engagementRate)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-ink-3 text-[11px]">Fit score</span>
          <span
            className={`chip ${scoreChipClass(score)} font-semibold`}
            title={rationale ?? undefined}
          >
            {scoreLabel}
          </span>
        </div>
      </div>

      {rationale && (
        <p
          className="text-[12px] text-ink-2 italic leading-snug"
          title={rationale}
        >
          {rationale}
        </p>
      )}

      <div className="flex justify-end pt-1 border-t border-line">
        <button
          type="button"
          onClick={() => setIsSavedLocal((v) => !v)}
          className="btn btn-ghost"
          aria-pressed={isSavedLocal}
          title={isSavedLocal ? "Saved (mock — Chunk 7)" : "Save to Database"}
        >
          {isSavedLocal ? (
            <>
              <BookmarkCheck size={14} />
              Saved
            </>
          ) : (
            <>
              <Bookmark size={14} />
              Save
            </>
          )}
        </button>
      </div>
    </article>
  );
}

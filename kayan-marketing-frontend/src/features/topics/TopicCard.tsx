import { useMemo, useState } from "react";
import { Sparkles, MapPin, Tag, Archive, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { PATTERN_BY_ID, type PatternId } from "../../constants/patterns";
import {
  TOPIC_OCCASION_LABELS,
  TOPIC_STATUS_LABELS,
  type TopicOccasion,
  type TopicStatus,
} from "../../constants/topics";
import {
  CONTENT_FORMAT_LABELS,
  CONTENT_FORMATS_WITH_PLATFORMS,
  type ContentFormat,
} from "../../constants/content-formats";
import { SOCIAL_PLATFORM_LABELS } from "../../constants/social-platform";
import type { Branch } from "../../types/branch";
import type { Topic } from "../../types/topic";

const STATUS_CHIP: Record<TopicStatus, string> = {
  queued: "bg-cream-2 text-ink-2",
  in_progress: "bg-yellow text-obsidian",
  used: "bg-sage text-[#2C5530]",
  archived: "bg-cream-2 text-ink-3",
};

interface Props {
  topic: Topic;
  branch: Branch | undefined;
  onUse: (topic: Topic) => void;
  onArchive: (topic: Topic) => void;
  isUsing: boolean;
  // Display language for title + description. The card falls back to the
  // other language if the requested one is empty (older topics may only
  // have one language populated).
  language: "en" | "ar";
}

// Pick the right field for the active language, falling back to the
// other if it's empty. Topics created before migration 0045 have only
// one of the pair populated.
function pickLocalized(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  if (primary && primary.trim().length > 0) return primary;
  if (fallback && fallback.trim().length > 0) return fallback;
  return null;
}

export function TopicCard({ topic, branch, onUse, onArchive, isUsing, language }: Props): JSX.Element {
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const patternName = useMemo(() => {
    if (!topic.patternId) return null;
    return PATTERN_BY_ID[topic.patternId as PatternId]?.name ?? topic.patternId;
  }, [topic.patternId]);

  const isUsed = topic.status === "used";
  const isArchived = topic.status === "archived";
  // Disable "Use this" for already-used topics — the backend would reject it
  // anyway, but hiding the path keeps the UI honest.
  const canUse = !isUsed && !isArchived;

  return (
    <article
      className={`card transition ${
        isArchived ? "opacity-60" : "hover:border-line-2"
      }`}
    >
      <header className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <h3
            className="font-serif text-[16px] tracking-tight text-ink leading-tight"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {language === "ar"
              ? (pickLocalized(topic.title, topic.titleEn) ?? topic.title)
              : (pickLocalized(topic.titleEn, topic.title) ?? topic.title)}
          </h3>
          {(() => {
            const desc =
              language === "ar"
                ? pickLocalized(topic.description, topic.descriptionEn)
                : pickLocalized(topic.descriptionEn, topic.description);
            return desc ? (
              <p
                className="text-[12.5px] text-ink-3 mt-1.5 leading-relaxed whitespace-pre-line"
                dir={language === "ar" ? "rtl" : "ltr"}
              >
                {desc}
              </p>
            ) : null;
          })()}
        </div>
        <span
          className={`chip flex-shrink-0 ${STATUS_CHIP[topic.status]}`}
          title={`Topic status: ${TOPIC_STATUS_LABELS[topic.status]}`}
        >
          {TOPIC_STATUS_LABELS[topic.status]}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {topic.patternId && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full bg-yellow text-obsidian font-bold tracking-wide"
            title={patternName ?? topic.patternId}
          >
            {topic.patternId}
            {patternName && (
              <span className="ml-1 font-medium opacity-80">
                {patternName}
              </span>
            )}
          </span>
        )}
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-cream-2 text-ink-2">
          {CONTENT_FORMAT_LABELS[topic.format as ContentFormat] ?? topic.format}
        </span>
        {CONTENT_FORMATS_WITH_PLATFORMS.has(topic.format) &&
          (topic.defaultPlatforms ?? []).map((p) => (
            <span
              key={p}
              className="text-[11px] px-2 py-0.5 rounded-full bg-cream text-ink-3 border border-line"
            >
              {SOCIAL_PLATFORM_LABELS[p]}
            </span>
          ))}
        {branch && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-sage text-[#2C5530] flex items-center gap-1">
            <MapPin size={10} />
            {branch.name}
          </span>
        )}
        {topic.occasion && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-peach text-[#7A3520]">
            {TOPIC_OCCASION_LABELS[topic.occasion as TopicOccasion] ?? topic.occasion}
          </span>
        )}
        {topic.theme && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-lavender text-[#4A3A6A] flex items-center gap-1">
            <Tag size={10} />
            {topic.theme}
          </span>
        )}
      </div>

      {topic.priority > 0 && (
        <div className="mt-3 text-[11px] text-ink-3">
          Priority: <span className="text-ink-2 font-semibold">{topic.priority}</span>
        </div>
      )}

      {isUsed && topic.usedAt && (
        <div className="mt-3 text-[11px] text-ink-3 flex items-center gap-1.5">
          <Sparkles size={10} className="text-sage-deep" />
          Used on {format(new Date(topic.usedAt), "MMM d, yyyy")}
        </div>
      )}

      {!isArchived && (
        <footer className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-line">
          {!confirmingArchive ? (
            <button
              type="button"
              onClick={() => setConfirmingArchive(true)}
              className="text-[12px] text-ink-3 hover:text-ink px-2 py-1 inline-flex items-center gap-1"
              title="Archive"
            >
              <Archive size={12} />
              Archive
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="text-ink-3">Archive?</span>
              <button
                onClick={() => {
                  setConfirmingArchive(false);
                  onArchive(topic);
                }}
                className="px-2 py-0.5 rounded text-rose-deep hover:bg-rose/40"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmingArchive(false)}
                className="px-2 py-0.5 rounded text-ink-2 hover:bg-cream-2"
              >
                No
              </button>
            </div>
          )}
          {canUse && (
            <button
              type="button"
              onClick={() => onUse(topic)}
              disabled={isUsing}
              className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
            >
              {isUsing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  Use this
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          )}
        </footer>
      )}
    </article>
  );
}

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Sparkles, AlertCircle, Lightbulb, Languages } from "lucide-react";
import { format, addDays } from "date-fns";
import { useCurrentBrand } from "../hooks/use-current-brand";
import { useBranches } from "../features/branches/hooks/use-branches";
import {
  useTopics,
  useUseTopic,
  useArchiveTopic,
} from "../features/topics/hooks/use-topics";
import { TopicCard } from "../features/topics/TopicCard";
import { SuggestTopicsModal } from "../features/topics/SuggestTopicsModal";
import { AddTopicModal } from "../features/topics/AddTopicModal";
import { PATTERNS, type PatternId } from "../constants/patterns";
import {
  TOPIC_OCCASIONS,
  TOPIC_OCCASION_LABELS,
  TOPIC_STATUSES,
  TOPIC_STATUS_LABELS,
  type TopicStatus,
  type TopicOccasion,
} from "../constants/topics";
import { ROUTES } from "../constants/routes";
import type { Topic } from "../types/topic";
import type { Branch } from "../types/branch";
import { logger } from "../utils/logger";

type StatusFilter = "all" | TopicStatus;

// Display language for topic title/description. Defaults to English so
// managers reviewing the queue read fluent copy at a glance; the AR
// toggle flips to Saudi-Arabic for the creator who'll actually shoot
// the topic. Persisted via URL search param so reloads stick.
export type TopicDisplayLanguage = "en" | "ar";

// Default scheduling lead time when "Use this" creates an entry. Lands the
// new entry a week out so the marketer has buffer to script + shoot.
const DEFAULT_LEAD_DAYS = 7;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TopicsPage(): JSX.Element {
  const navigate = useNavigate();
  const { brandId } = useCurrentBrand();
  const [searchParams, setSearchParams] = useSearchParams();

  // Display language (URL search param `?lang=ar|en`, defaults to en).
  const language: TopicDisplayLanguage =
    searchParams.get("lang") === "ar" ? "ar" : "en";
  const setLanguage = (next: TopicDisplayLanguage): void => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (next === "en") sp.delete("lang");
        else sp.set("lang", next);
        return sp;
      },
      { replace: true },
    );
  };

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("queued");
  const [occasionFilter, setOccasionFilter] = useState<TopicOccasion | "">("");
  const [patternFilter, setPatternFilter] = useState<PatternId | "">("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Track which topic is mid-conversion so the spinner only shows on its card.
  const [usingTopicId, setUsingTopicId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const topics = useTopics({
    status: statusFilter,
    occasion: occasionFilter || undefined,
  });
  const branches = useBranches(brandId);
  const useTopicMut = useUseTopic();
  const archive = useArchiveTopic();

  // Pattern filter is applied client-side because the backend list endpoint
  // doesn't filter by pattern_id (and adding it now would mean a function
  // redeploy for a single dropdown). Topic counts are small (<200) so this
  // is fine.
  const filtered = useMemo(() => {
    const data = topics.data ?? [];
    if (!patternFilter) return data;
    return data.filter((t) => t.patternId === patternFilter);
  }, [topics.data, patternFilter]);

  const branchById = useMemo(() => {
    const map = new Map<string, Branch>();
    for (const b of branches.data ?? []) map.set(b.id, b);
    return map;
  }, [branches.data]);

  const handleUse = async (topic: Topic): Promise<void> => {
    setActionError(null);
    setUsingTopicId(topic.id);
    try {
      // Defaults: target +7 days, Ammar (script + shoot owner). Marketer
      // can edit everything inside the entry detail panel after landing.
      const targetDate = format(addDays(new Date(todayIso()), DEFAULT_LEAD_DAYS), "yyyy-MM-dd");
      const result = await useTopicMut.mutateAsync({
        id: topic.id,
        input: {
          targetDate,
          assignee: "ammar",
          // For batch-mode video entries we'd ideally pick a shoot date,
          // but without one the backend falls back to the legacy chain
          // (no error). Marketer sets shoot date on the entry afterwards.
          productionMode: "batch",
          editorDaysOffset: 2,
          autoCreateTasks: true,
        },
      });
      logger.info("topic used", {
        topicId: topic.id,
        entryId: result.entry.id,
      });
      // Navigate to the calendar with the new entry's detail panel open.
      navigate(`${ROUTES.CALENDAR}?entryId=${result.entry.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't create entry";
      setActionError(message);
      logger.error("use topic failed", { err: String(err), topicId: topic.id });
    } finally {
      setUsingTopicId(null);
    }
  };

  const handleArchive = async (topic: Topic): Promise<void> => {
    setActionError(null);
    try {
      await archive.mutateAsync(topic.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Archive failed";
      setActionError(message);
      logger.error("archive topic failed", { err: String(err), topicId: topic.id });
    }
  };

  const isEmpty = !topics.isLoading && filtered.length === 0;
  const totalRaw = topics.data?.length ?? 0;
  const isFiltered = patternFilter !== "" || occasionFilter !== "" || statusFilter !== "queued";

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5 md:mb-6">
        <div>
          <h1 className="h-greeting text-[24px] md:text-[30px]">
            Topics <em>queue</em>
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
            Pre-planned ideas, ready to spawn entries in one click.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAddOpen(true)} className="btn btn-ghost">
            <Plus size={14} />
            <span className="hidden sm:inline">Add manually</span>
            <span className="sm:hidden">Add</span>
          </button>
          <button onClick={() => setSuggestOpen(true)} className="btn btn-primary">
            <Sparkles size={14} />
            <span className="hidden sm:inline">Suggest with AI</span>
            <span className="sm:hidden">Suggest</span>
          </button>
        </div>
      </header>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2 mb-5 md:mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="form-select !py-1.5 !text-[12.5px] !w-auto"
        >
          <option value="all">All statuses</option>
          {TOPIC_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TOPIC_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={occasionFilter}
          onChange={(e) => setOccasionFilter(e.target.value as TopicOccasion | "")}
          className="form-select !py-1.5 !text-[12.5px] !w-auto"
        >
          <option value="">Any occasion</option>
          {TOPIC_OCCASIONS.map((o) => (
            <option key={o} value={o}>
              {TOPIC_OCCASION_LABELS[o]}
            </option>
          ))}
        </select>
        <select
          value={patternFilter}
          onChange={(e) => setPatternFilter(e.target.value as PatternId | "")}
          className="form-select !py-1.5 !text-[12.5px] !w-auto"
        >
          <option value="">Any pattern</option>
          {PATTERNS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} — {p.name}
            </option>
          ))}
        </select>
        {isFiltered && (
          <button
            onClick={() => {
              setStatusFilter("queued");
              setOccasionFilter("");
              setPatternFilter("");
            }}
            className="text-[12px] text-ink-3 hover:text-ink underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        )}
        {/* Language toggle — switches the title/description rendering on
            every TopicCard. EN is the default for at-a-glance manager
            review; AR shows the creator-facing Saudi text for shoot day. */}
        <div
          className="tab-group ml-2"
          role="group"
          aria-label="Topic display language"
        >
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`tab !px-3 !py-1 !text-[12px] ${language === "en" ? "tab-active" : ""}`}
            aria-pressed={language === "en"}
          >
            <Languages size={11} className="inline -mt-0.5 mr-1" />
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage("ar")}
            className={`tab !px-3 !py-1 !text-[12px] ${language === "ar" ? "tab-active" : ""}`}
            aria-pressed={language === "ar"}
          >
            AR
          </button>
        </div>
        <span className="ml-auto text-[12px] text-ink-3">
          {topics.isLoading
            ? "Loading…"
            : `${filtered.length}${
                filtered.length !== totalRaw && totalRaw > 0 ? ` of ${totalRaw}` : ""
              } topic${filtered.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {actionError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-3 mb-4 text-[13px] flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {topics.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 mb-4 text-[13px]">
          {topics.error instanceof Error ? topics.error.message : "Failed to load topics."}
        </div>
      )}

      {topics.isLoading && <p className="text-ink-3 text-[13px] py-4">Loading topics…</p>}

      {isEmpty && (
        <div className="card text-center py-16">
          <Lightbulb size={28} className="mx-auto text-ink-3 mb-3" />
          <h3 className="font-serif text-[16px] text-ink mb-1.5">
            {isFiltered ? "No topics match these filters" : "No topics yet"}
          </h3>
          <p className="text-[13px] text-ink-3 mb-4 max-w-md mx-auto">
            {isFiltered
              ? "Try clearing some filters, or generate fresh ideas based on your brand DNA."
              : "Click “Suggest with AI” to generate your first batch, or add one manually to start the queue."}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setAddOpen(true)} className="btn btn-ghost">
              <Plus size={14} />
              Add manually
            </button>
            <button onClick={() => setSuggestOpen(true)} className="btn btn-primary">
              <Sparkles size={14} />
              Suggest with AI
            </button>
          </div>
        </div>
      )}

      {!isEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              branch={topic.branchId ? branchById.get(topic.branchId) : undefined}
              onUse={handleUse}
              onArchive={handleArchive}
              isUsing={usingTopicId === topic.id}
              language={language}
            />
          ))}
        </div>
      )}

      <SuggestTopicsModal isOpen={suggestOpen} onClose={() => setSuggestOpen(false)} />
      <AddTopicModal brandId={brandId} isOpen={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

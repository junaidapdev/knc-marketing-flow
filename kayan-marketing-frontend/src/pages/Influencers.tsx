import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Plus, Search, ShieldCheck } from "lucide-react";
import { ROUTES } from "../constants/routes";
import {
  INFLUENCER_NICHE_TAGS,
  INFLUENCER_NICHE_TAG_LABELS,
  type InfluencerNicheTag,
} from "../constants/influencer-niche-tags";
import {
  INFLUENCER_STATUS,
  INFLUENCER_STATUS_LABELS,
  type InfluencerStatus,
} from "../constants/influencer-status";
import {
  classifyTier,
  highestFollowerCount,
} from "../constants/influencer-tiers";
import {
  INFLUENCER_PLATFORMS,
  INFLUENCER_PLATFORM_LABELS,
  hasPlatform,
  type InfluencerPlatform,
} from "../constants/influencer-platforms";
import {
  cityBuckets,
  type InfluencerCity,
} from "../constants/influencer-cities";
import { InfluencerFormModal } from "../features/influencers/InfluencerFormModal";
import { InfluencerCard } from "../features/influencers/InfluencerCard";
import { InfluencerDetailPanel } from "../features/influencers/InfluencerDetailPanel";
import { UndoToast } from "../features/influencers/UndoToast";
import { useInfluencersWithReliability } from "../features/influencers/hooks/use-influencers";
import { useDeleteEntry } from "../features/calendar/hooks/use-calendar-entries";
import { logger } from "../utils/logger";
import {
  InstagramIcon,
  SnapchatIcon,
  TikTokIcon,
} from "../features/influencers/icons";
import type {
  InfluencerReliability,
  InfluencerWithReliability,
} from "../types/influencer";

type StatusKey = "all" | InfluencerStatus;
type TierKey = "all" | "macro" | "mid" | "micro";
type CityKey = "all" | InfluencerCity;
type ReliabilityFilter = "all" | "high" | "needs-review";

// Location filter — the three main Kayan cities plus the two outliers
// present in the data (Riyadh, Taif). Matching is keyword-based, so
// Arabic spelling variants all collapse onto these.
const CITY_FILTERS: ReadonlyArray<{ key: CityKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "makkah", label: "Makkah" },
  { key: "jeddah", label: "Jeddah" },
  { key: "madinah", label: "Madinah" },
  { key: "riyadh", label: "Riyadh" },
  { key: "taif", label: "Taif" },
];

const STATUS_FILTERS: ReadonlyArray<{ key: StatusKey; label: string }> = [
  { key: "all", label: "All" },
  { key: INFLUENCER_STATUS.ACTIVE, label: INFLUENCER_STATUS_LABELS.active },
  { key: INFLUENCER_STATUS.PAUSED, label: INFLUENCER_STATUS_LABELS.paused },
  {
    key: INFLUENCER_STATUS.BLACKLISTED,
    label: INFLUENCER_STATUS_LABELS.blacklisted,
  },
];

// Tier filter chips — match the design's 3 buckets (Macro / Mid / Micro)
// plus "All". Nano creators (<10K) still get classified by the card's
// tier badge, they just aren't a filter target. If that changes,
// extend this list and the TierKey union above.
const TIER_FILTERS: ReadonlyArray<{
  key: TierKey;
  label: string;
  dotClass: string | null;
  activeBg: string;
}> = [
  { key: "all", label: "All", dotClass: null, activeBg: "bg-cream-2" },
  { key: "macro", label: "Macro", dotClass: "bg-lavender-deep", activeBg: "bg-lavender" },
  { key: "mid", label: "Mid", dotClass: "bg-[#D4A82A]", activeBg: "bg-butter" },
  { key: "micro", label: "Micro", dotClass: "bg-sage-deep", activeBg: "bg-sage" },
];

// Composite reliability indicator: min of the three rates, or null if
// any rate is null OR the score isn't available yet. Drives the
// high-reliability / needs-review filter buckets.
function compositeReliability(rel: InfluencerReliability | null): number | null {
  if (!rel) return null;
  if (rel.postRate === null || rel.tagRate === null || rel.onTimeRate === null) {
    return null;
  }
  return Math.min(rel.postRate, rel.tagRate, rel.onTimeRate);
}

export default function InfluencersPage(): JSX.Element {
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusKey>("all");
  const [tier, setTier] = useState<TierKey>("all");
  const [city, setCity] = useState<CityKey>("all");
  const [platforms, setPlatforms] = useState<InfluencerPlatform[]>([]);
  const [query, setQuery] = useState("");
  const [niche, setNiche] = useState<"all" | InfluencerNicheTag>("all");
  const [reliabilityFilter, setReliabilityFilter] =
    useState<ReliabilityFilter>("all");
  const [undoToast, setUndoToast] = useState<{
    entryId: string;
    message: string;
  } | null>(null);
  const deleteEntry = useDeleteEntry();

  // Server-side filters: search + niche only. Status moved client-side
  // so the tab counts can partition by status without an extra fetch.
  const serverFilters = useMemo(
    () => ({
      q: query.trim() || undefined,
      niche: niche === "all" ? undefined : niche,
    }),
    [query, niche],
  );
  const influencers = useInfluencersWithReliability(serverFilters);

  // After tier + platform are applied, but before status — this set
  // is what the status tab counts partition.
  const tierPlatformFiltered = useMemo<InfluencerWithReliability[]>(() => {
    const rows = influencers.data ?? [];
    return rows.filter((row) => {
      if (tier !== "all") {
        const rowTier = classifyTier(highestFollowerCount(row));
        if (rowTier !== tier) return false;
      }
      if (platforms.length > 0) {
        const hit = platforms.some((p) => hasPlatform(row, p));
        if (!hit) return false;
      }
      return true;
    });
  }, [influencers.data, tier, platforms]);

  // City counts — partition the tier+platform set by canonical city. A
  // creator who lists two cities counts under each, so these can sum to
  // more than the "all" total.
  const cityCounts = useMemo(() => {
    const counts: Record<CityKey, number> = {
      all: tierPlatformFiltered.length,
      makkah: 0,
      jeddah: 0,
      madinah: 0,
      riyadh: 0,
      taif: 0,
    };
    for (const row of tierPlatformFiltered) {
      for (const bucket of cityBuckets(row.city)) counts[bucket] += 1;
    }
    return counts;
  }, [tierPlatformFiltered]);

  // Apply the city filter on top of tier+platform.
  const cityFiltered = useMemo<InfluencerWithReliability[]>(() => {
    if (city === "all") return tierPlatformFiltered;
    return tierPlatformFiltered.filter((row) =>
      cityBuckets(row.city).includes(city),
    );
  }, [tierPlatformFiltered, city]);

  // Partition counts for the status tabs — over the city-filtered set so
  // the tab counts react to the active location.
  const statusCounts = useMemo(() => {
    const counts: Record<StatusKey, number> = {
      all: cityFiltered.length,
      active: 0,
      paused: 0,
      blacklisted: 0,
    };
    for (const row of cityFiltered) {
      counts[row.status] += 1;
    }
    return counts;
  }, [cityFiltered]);

  // Final list: apply status + reliability on top of tier+platform+city.
  const filteredRows = useMemo<InfluencerWithReliability[]>(() => {
    let rows = cityFiltered;
    if (status !== "all") {
      rows = rows.filter((r) => r.status === status);
    }
    if (reliabilityFilter !== "all") {
      rows = rows.filter((row) => {
        const rel = row.reliability;
        const composite = compositeReliability(rel);
        if (reliabilityFilter === "high") {
          return (
            rel !== null &&
            rel.postRate !== null && rel.postRate >= 80 &&
            rel.tagRate !== null && rel.tagRate >= 80 &&
            rel.onTimeRate !== null && rel.onTimeRate >= 80
          );
        }
        // needs-review: any rate < 50, OR no score yet
        if (composite === null) return true;
        return (
          (rel?.postRate !== null && (rel?.postRate ?? 100) < 50) ||
          (rel?.tagRate !== null && (rel?.tagRate ?? 100) < 50) ||
          (rel?.onTimeRate !== null && (rel?.onTimeRate ?? 100) < 50)
        );
      });
    }
    return rows;
  }, [cityFiltered, status, reliabilityFilter]);

  const togglePlatform = (p: InfluencerPlatform): void => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5 md:mb-6">
        <div>
          <h1 className="h-greeting text-[24px] md:text-[30px]">
            Influencer <em>database</em>
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
            Manage Kayan's creator contacts, rates, fit, and platform reach.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={ROUTES.INFLUENCER_VERIFICATIONS}
            className="btn btn-ghost"
            title="Review submitted posts and log performance"
          >
            <ShieldCheck size={14} />
            <span className="hidden sm:inline">Verifications</span>
            <span className="sm:hidden">Verify</span>
          </Link>
          <button onClick={() => setCreating(true)} className="btn btn-primary">
            <Plus size={14} />
            <span className="hidden sm:inline">Add Influencer</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </header>

      <section className="card mb-5 space-y-4">
        {/* Row 1: status tabs with counts · tier filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="tab-group inline-flex overflow-x-auto max-w-full">
            {STATUS_FILTERS.map((item) => {
              const isActive = status === item.key;
              const count = statusCounts[item.key];
              return (
                <button
                  key={item.key}
                  onClick={() => setStatus(item.key)}
                  className={`tab inline-flex items-center gap-1.5 ${
                    isActive ? "tab-active" : ""
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`min-w-[20px] text-center px-1.5 py-px rounded text-[10px] font-bold tabular-nums ${
                      isActive
                        ? "bg-white/15 text-yellow"
                        : "bg-cream text-ink-3"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="inline-flex items-center gap-1 flex-wrap">
            {TIER_FILTERS.map((item) => {
              const isActive = tier === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTier(item.key)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition ${
                    isActive
                      ? `${item.activeBg} text-ink`
                      : "text-ink-2 hover:bg-cream-2"
                  }`}
                  aria-pressed={isActive}
                >
                  {item.dotClass && (
                    <span className={`w-2 h-2 rounded-full ${item.dotClass}`} />
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: search · niche · platform */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="relative flex-1 min-w-[200px] block">
            <span className="sr-only">Search influencers</span>
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="form-input pl-9"
              placeholder="Search name, WhatsApp, or handle"
            />
          </label>

          <div className="flex items-center gap-2">
            <span className="eyebrow">Niche</span>
            <div className="relative inline-block">
              <select
                value={niche}
                onChange={(event) =>
                  setNiche(event.target.value as "all" | InfluencerNicheTag)
                }
                className="appearance-none bg-cream-2 hover:bg-yellow-soft rounded-full pl-3 pr-8 py-1.5 text-[12px] font-semibold text-ink cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-yellow"
                aria-label="Filter by niche"
              >
                <option value="all">All niches</option>
                {INFLUENCER_NICHE_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {INFLUENCER_NICHE_TAG_LABELS[tag]}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-3"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="eyebrow">Platform</span>
            {INFLUENCER_PLATFORMS.map((p) => {
              const isSelected = platforms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition border ${
                    isSelected
                      ? "bg-obsidian text-yellow border-obsidian"
                      : "bg-transparent text-ink-2 border-line-2 hover:bg-cream-2"
                  }`}
                  aria-pressed={isSelected}
                >
                  {p === "tiktok" && <TikTokIcon className="w-3 h-3" />}
                  {p === "instagram" && <InstagramIcon className="w-3 h-3" />}
                  {p === "snapchat" && <SnapchatIcon className="w-3 h-3" />}
                  {INFLUENCER_PLATFORM_LABELS[p]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: location filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="eyebrow mr-1">Location:</span>
          {CITY_FILTERS.map((item) => {
            const isActive = city === item.key;
            const count = cityCounts[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setCity(item.key)}
                className={`chip inline-flex items-center gap-1.5 ${
                  isActive
                    ? "bg-obsidian text-yellow"
                    : "chip-default hover:brightness-95"
                }`}
                aria-pressed={isActive}
              >
                {item.label}
                <span
                  className={`text-[10px] font-bold tabular-nums ${
                    isActive ? "text-yellow/80" : "text-ink-3"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 4: reliability quick-filter (kept from previous design) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="eyebrow mr-1">Reliability:</span>
          {(
            [
              { key: "all", label: "All" },
              { key: "high", label: "High reliability" },
              { key: "needs-review", label: "Needs review" },
            ] as const
          ).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setReliabilityFilter(c.key)}
              className={`chip ${
                reliabilityFilter === c.key
                  ? "bg-obsidian text-yellow"
                  : "chip-default hover:brightness-95"
              }`}
              aria-pressed={reliabilityFilter === c.key}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {influencers.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 mb-4 text-[13px]">
          {influencers.error instanceof Error
            ? influencers.error.message
            : "Failed to load influencers."}
        </div>
      )}
      {influencers.isLoading && (
        <p className="text-ink-3 text-[13px] py-4">Loading...</p>
      )}
      {influencers.data && filteredRows.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-ink-3 text-[13.5px]">
            {reliabilityFilter === "high" &&
              "No high-reliability influencers yet. After a creator runs 3+ collabs with strong post / tag / on-time rates, they'll appear here."}
            {reliabilityFilter === "needs-review" &&
              "Nothing to review — every active creator either has solid scores or hasn't started collaborating yet. 🎉"}
            {reliabilityFilter === "all" &&
              "No influencers match these filters. Try clearing them, or add a new creator."}
          </p>
        </div>
      )}

      {influencers.data && filteredRows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-4">
          {filteredRows.map((influencer) => (
            <InfluencerCard
              key={influencer.id}
              influencer={influencer}
              onView={() => setDetailId(influencer.id)}
              onBooked={(args) => setUndoToast(args)}
            />
          ))}
        </div>
      )}

      <InfluencerFormModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        editing={null}
      />

      {detailId && (
        <InfluencerDetailPanel
          influencerId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}

      {undoToast && (
        <UndoToast
          message={undoToast.message}
          onUndo={() => {
            const { entryId } = undoToast;
            deleteEntry.mutate(entryId, {
              onSuccess: () => {
                logger.info("quick-book undone", { entryId });
                setUndoToast(null);
              },
              onError: (err) => {
                logger.error("quick-book undo failed", {
                  err: err instanceof Error ? err.message : String(err),
                });
                setUndoToast(null);
              },
            });
          }}
          onDismiss={() => setUndoToast(null)}
        />
      )}
    </div>
  );
}

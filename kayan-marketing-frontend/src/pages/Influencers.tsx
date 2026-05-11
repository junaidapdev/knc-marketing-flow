import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, ShieldCheck } from "lucide-react";
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
import { InfluencerFormModal } from "../features/influencers/InfluencerFormModal";
import { useInfluencersWithReliability } from "../features/influencers/hooks/use-influencers";
import type {
  Influencer,
  InfluencerReliability,
  InfluencerWithReliability,
} from "../types/influencer";

const STATUS_FILTERS: ReadonlyArray<{
  key: "all" | InfluencerStatus;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: INFLUENCER_STATUS.ACTIVE, label: INFLUENCER_STATUS_LABELS.active },
  { key: INFLUENCER_STATUS.PAUSED, label: INFLUENCER_STATUS_LABELS.paused },
  {
    key: INFLUENCER_STATUS.BLACKLISTED,
    label: INFLUENCER_STATUS_LABELS.blacklisted,
  },
];

const FOLLOWER_TIERS: ReadonlyArray<{ label: string; min: number }> = [
  { label: "Macro", min: 500_000 },
  { label: "Mid", min: 100_000 },
  { label: "Micro", min: 10_000 },
  { label: "Nano", min: 1 },
];

function statusChipClass(status: InfluencerStatus): string {
  switch (status) {
    case INFLUENCER_STATUS.ACTIVE:
      return "status-active";
    case INFLUENCER_STATUS.PAUSED:
      return "status-planned";
    case INFLUENCER_STATUS.BLACKLISTED:
      return "status-overdue";
    default:
      return "status-planned";
  }
}

function highestFollowerCount(influencer: Influencer): number {
  return Math.max(
    influencer.tiktokFollowers ?? 0,
    influencer.instagramFollowers ?? 0,
    influencer.snapchatFollowers ?? 0,
  );
}

function followerTier(influencer: Influencer): string {
  const count = highestFollowerCount(influencer);
  const tier = FOLLOWER_TIERS.find((item) => count >= item.min);
  return tier?.label ?? "Unlisted";
}

function platformChips(influencer: Influencer): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      {influencer.tiktokHandle && (
        <span className="chip chip-tiktok">TikTok</span>
      )}
      {influencer.instagramHandle && (
        <span className="chip chip-ig">Instagram</span>
      )}
      {influencer.snapchatHandle && (
        <span className="chip chip-snap">Snapchat</span>
      )}
    </div>
  );
}

function formatRate(rate: number | null): string {
  if (rate === null) return "Not set";
  return `${rate.toLocaleString()} SAR`;
}

// Composite reliability indicator: min of the three rates, or null if
// any rate is null OR the score isn't available yet. Drives both the
// table column color and the high-reliability / needs-review filters.
function compositeReliability(rel: InfluencerReliability | null): number | null {
  if (!rel) return null;
  if (rel.postRate === null || rel.tagRate === null || rel.onTimeRate === null) {
    return null;
  }
  return Math.min(rel.postRate, rel.tagRate, rel.onTimeRate);
}

type ReliabilityFilter = "all" | "high" | "needs-review";

export default function InfluencersPage(): JSX.Element {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<"all" | InfluencerStatus>("all");
  const [query, setQuery] = useState("");
  const [niche, setNiche] = useState<"all" | InfluencerNicheTag>("all");
  const [reliabilityFilter, setReliabilityFilter] =
    useState<ReliabilityFilter>("all");

  const filters = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      q: query.trim() || undefined,
      niche: niche === "all" ? undefined : niche,
    }),
    [status, query, niche],
  );
  const influencers = useInfluencersWithReliability(filters);

  // Reliability is filtered client-side because it lives in a derived
  // JSONB attached to each row, not as a direct DB column. With ≤200
  // influencers this is fast; if the database grows, add a SQL view.
  const filteredRows = useMemo<InfluencerWithReliability[]>(() => {
    const rows = influencers.data ?? [];
    if (reliabilityFilter === "all") return rows;
    return rows.filter((row) => {
      const rel = row.reliability;
      const composite = compositeReliability(rel);
      if (reliabilityFilter === "high") {
        // All three rates ≥ 80
        return (
          rel !== null &&
          rel.postRate !== null && rel.postRate >= 80 &&
          rel.tagRate !== null && rel.tagRate >= 80 &&
          rel.onTimeRate !== null && rel.onTimeRate >= 80
        );
      }
      // needs-review: any rate < 50, OR no reliability score available yet
      // (no eligible collabs / no submissions).
      if (composite === null) return true;
      return (
        (rel?.postRate !== null && (rel?.postRate ?? 100) < 50) ||
        (rel?.tagRate !== null && (rel?.tagRate ?? 100) < 50) ||
        (rel?.onTimeRate !== null && (rel?.onTimeRate ?? 100) < 50)
      );
    });
  }, [influencers.data, reliabilityFilter]);

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
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="tab-group inline-flex">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.key}
                onClick={() => setStatus(item.key)}
                className={`tab ${status === item.key ? "tab-active" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
          <label className="relative block">
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
          <label>
            <span className="sr-only">Filter by niche</span>
            <select
              value={niche}
              onChange={(event) =>
                setNiche(event.target.value as "all" | InfluencerNicheTag)
              }
              className="form-select"
            >
              <option value="all">All niches</option>
              {INFLUENCER_NICHE_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {INFLUENCER_NICHE_TAG_LABELS[tag]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {/* Reliability quick-filter — chip row below the search bar.
            All-three-rates-≥80 is the high bar; any-rate-<50 OR no
            score yet is the needs-review bucket. */}
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
        <>
          <div className="hidden lg:block card p-0 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-cream-2/50 text-left">
                <tr>
                  <th className="px-4 py-3 eyebrow">Name</th>
                  <th className="px-4 py-3 eyebrow">WhatsApp</th>
                  <th className="px-4 py-3 eyebrow">Platforms</th>
                  <th className="px-4 py-3 eyebrow">Tier</th>
                  <th className="px-4 py-3 eyebrow">Status</th>
                  <th className="px-4 py-3 eyebrow">Reliability</th>
                  <th className="px-4 py-3 eyebrow">Niches</th>
                  <th className="px-4 py-3 eyebrow text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((influencer) => (
                  <tr
                    key={influencer.id}
                    onClick={() =>
                      navigate(ROUTES.INFLUENCER_DETAIL(influencer.id))
                    }
                    className="cursor-pointer border-t border-line hover:bg-cream-2/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">
                        {influencer.displayName}
                      </div>
                      {influencer.city && (
                        <div className="text-[11.5px] text-ink-3 mt-0.5">
                          {influencer.city}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {influencer.whatsapp}
                    </td>
                    <td className="px-4 py-3">{platformChips(influencer)}</td>
                    <td className="px-4 py-3 text-ink-2">
                      <span className="font-semibold text-ink">
                        {followerTier(influencer)}
                      </span>
                      <div className="text-[11.5px] text-ink-3">
                        {highestFollowerCount(influencer).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`chip ${statusChipClass(influencer.status)}`}
                      >
                        {INFLUENCER_STATUS_LABELS[influencer.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ReliabilityCell reliability={influencer.reliability} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {influencer.nicheTags.slice(0, 3).map((tag) => (
                          <span key={tag} className="chip chip-default">
                            {INFLUENCER_NICHE_TAG_LABELS[tag]}
                          </span>
                        ))}
                        {influencer.nicheTags.length > 3 && (
                          <span className="chip chip-default">
                            +{influencer.nicheTags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2">
                      {formatRate(influencer.standardRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden flex flex-col gap-3">
            {filteredRows.map((influencer) => (
              <button
                key={influencer.id}
                onClick={() =>
                  navigate(ROUTES.INFLUENCER_DETAIL(influencer.id))
                }
                className="card text-left p-4 hover:bg-cream-2/30 transition"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink text-[14px] truncate">
                      {influencer.displayName}
                    </div>
                    <div className="text-[12px] text-ink-3 mt-0.5">
                      {influencer.whatsapp}
                    </div>
                  </div>
                  <span
                    className={`chip ${statusChipClass(influencer.status)} flex-shrink-0`}
                  >
                    {INFLUENCER_STATUS_LABELS[influencer.status]}
                  </span>
                </div>
                <div className="mb-2">{platformChips(influencer)}</div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {influencer.nicheTags.map((tag) => (
                    <span key={tag} className="chip chip-default">
                      {INFLUENCER_NICHE_TAG_LABELS[tag]}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[12px] text-ink-2">
                  <span>
                    {followerTier(influencer)} ·{" "}
                    {highestFollowerCount(influencer).toLocaleString()}
                  </span>
                  <span>{formatRate(influencer.standardRate)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <InfluencerFormModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        editing={null}
      />
    </div>
  );
}

// Small composite reliability indicator for the list — shows the worst
// of the three rates so the list highlights the weakest link. Color-
// coded: ≥80 sage, ≥50 yellow, else rose. Renders "—" when the score
// isn't computable yet (no eligible collabs / submissions).
function ReliabilityCell({
  reliability,
}: {
  reliability: InfluencerReliability | null;
}): JSX.Element {
  const composite = compositeReliability(reliability);
  if (composite === null) {
    return (
      <span className="text-[11.5px] text-ink-3 italic" title="Reliability requires 3+ collabs with submissions">
        —
      </span>
    );
  }
  const chipClass =
    composite >= 80
      ? "bg-sage text-[#2C5530]"
      : composite >= 50
        ? "bg-yellow text-obsidian"
        : "bg-rose text-[#6E2A35]";
  const title = reliability
    ? `Post ${reliability.postRate ?? "—"}% · Tag ${reliability.tagRate ?? "—"}% · On-time ${reliability.onTimeRate ?? "—"}%`
    : "";
  return (
    <span
      className={`chip ${chipClass} font-semibold !text-[11px] tabular-nums`}
      title={title}
    >
      {composite}%
    </span>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAIStore } from "../stores/ai-store";
import { ChevronLeft } from "lucide-react";
import {
  useCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
} from "../features/campaigns/hooks/use-campaigns";
import { useCampaignEntries } from "../features/campaigns/hooks/use-campaign-entries";
import { EntryDetailPanel } from "../features/calendar/EntryDetailPanel";
import { ROUTES } from "../constants/routes";
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
  AD_PLATFORM_LABELS,
  AD_OBJECTIVE_LABELS,
  type CampaignStatus,
  type CampaignType,
  type AdPlatform,
  type AdObjective,
} from "../constants/campaign";
import { ASSIGNEE_LABELS } from "../constants/task-chains";
import type { CampaignDetail } from "../types/campaign";
import { logger } from "../utils/logger";

const TABS = ["overview", "rollouts", "content", "ads", "budget", "results"] as const;
type TabKey = (typeof TABS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  overview: "Overview",
  rollouts: "Branch Rollout",
  content: "Linked Content",
  ads: "Ad Spend",
  budget: "Budget",
  results: "Results",
};

export default function CampaignDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("overview");
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  const detail = useCampaign(id ?? null);
  const setAIContext = useAIStore((s) => s.setContext);
  const resetAIContext = useAIStore((s) => s.resetContextToFreeform);

  useEffect(() => {
    if (detail.data && id) {
      setAIContext({
        type: "campaign",
        contextId: id,
        label: `Campaign · ${detail.data.name}`,
        payload: {
          campaign: {
            name: detail.data.name,
            campaignType: detail.data.campaignType,
            status: detail.data.status,
            startDate: detail.data.startDate,
            endDate: detail.data.endDate,
            totalBudget: detail.data.totalBudget,
            totalSpent: detail.data.totalSpent,
            offerTrigger: detail.data.offerTrigger,
            offerReward: detail.data.offerReward,
            promoCode: detail.data.promoCode,
          },
        },
      });
    }
    return () => {
      resetAIContext();
    };
  }, [id, detail.data, setAIContext, resetAIContext]);

  if (!id) {
    return <div className="px-9 pt-8 text-rose-deep">Missing campaign id.</div>;
  }

  return (
    <div className="px-9 pt-8 pb-12">
      <button
        onClick={() => navigate(ROUTES.CAMPAIGNS)}
        className="flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink mb-4"
      >
        <ChevronLeft size={14} />
        Back to Campaigns
      </button>

      {detail.isLoading && <p className="text-ink-3 text-[13px] py-8">Loading…</p>}
      {detail.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4">
          {detail.error instanceof Error ? detail.error.message : "Failed to load campaign."}
        </div>
      )}

      {detail.data && (
        <>
          <CampaignHeader campaign={detail.data} />

          <nav className="flex flex-wrap gap-1 border-b border-line mb-5">
            {TABS.map((key) => {
              const locked =
                key === "results" && detail.data!.status !== CAMPAIGN_STATUSES.COMPLETED;
              return (
                <button
                  key={key}
                  onClick={() => !locked && setTab(key)}
                  disabled={locked}
                  className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition ${
                    tab === key
                      ? "border-obsidian text-ink"
                      : "border-transparent text-ink-2 hover:text-ink"
                  } ${locked ? "opacity-40 cursor-not-allowed" : ""}`}
                  title={locked ? "Unlocks when campaign is marked completed" : undefined}
                >
                  {TAB_LABELS[key]}
                  {locked && <span className="ml-1 text-[10px]">🔒</span>}
                </button>
              );
            })}
          </nav>

          {tab === "overview" && <OverviewTab campaign={detail.data} />}
          {tab === "rollouts" && (
            <RolloutsTab campaign={detail.data} onOpenEntry={setOpenEntryId} />
          )}
          {tab === "content" && (
            <ContentTab campaignId={detail.data.id} onOpenEntry={setOpenEntryId} />
          )}
          {tab === "ads" && <AdSpendTab campaign={detail.data} />}
          {tab === "budget" && <BudgetTab campaign={detail.data} />}
          {tab === "results" && <ResultsTab campaign={detail.data} />}
        </>
      )}

      <EntryDetailPanel entryId={openEntryId} onClose={() => setOpenEntryId(null)} />
    </div>
  );
}

function CampaignHeader({ campaign }: { campaign: CampaignDetail }): JSX.Element {
  const update = useUpdateCampaign();
  const remove = useDeleteCampaign();
  const navigate = useNavigate();

  const setStatus = async (status: CampaignStatus): Promise<void> => {
    try {
      await update.mutateAsync({ id: campaign.id, input: { status } });
    } catch (err) {
      logger.error("update campaign status failed", { err: String(err) });
    }
  };

  const onDelete = async (): Promise<void> => {
    const ok = window.confirm(
      "Delete this campaign? Linked rollouts and ad-spend lines will be removed; calendar entries created from rollouts will remain.",
    );
    if (!ok) return;
    try {
      await remove.mutateAsync(campaign.id);
      navigate(ROUTES.CAMPAIGNS);
    } catch (err) {
      logger.error("delete campaign failed", { err: String(err) });
    }
  };

  return (
    <header className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="h-greeting">{campaign.name}</h1>
        <p className="text-[14px] text-ink-2 mt-1.5">
          {CAMPAIGN_TYPE_LABELS[campaign.campaignType as CampaignType] ?? campaign.campaignType} ·{" "}
          {campaign.startDate} → {campaign.endDate}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={campaign.status}
          onChange={(e) => setStatus(e.target.value as CampaignStatus)}
          disabled={update.isPending}
          className="form-select text-[13px]"
        >
          {Object.values(CAMPAIGN_STATUSES).map((s) => (
            <option key={s} value={s}>
              {CAMPAIGN_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          onClick={onDelete}
          disabled={remove.isPending}
          className="px-3 py-2 text-[13px] text-rose-deep hover:brightness-90 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </header>
  );
}

function OverviewTab({ campaign }: { campaign: CampaignDetail }): JSX.Element {
  const rows: Array<[string, string | number | null]> = [
    ["Type", CAMPAIGN_TYPE_LABELS[campaign.campaignType as CampaignType] ?? campaign.campaignType],
    ["Status", CAMPAIGN_STATUS_LABELS[campaign.status]],
    ["Start", campaign.startDate],
    ["End", campaign.endDate],
    ["Total budget", `${campaign.totalBudget.toLocaleString()} SAR`],
    ["Total spent", `${campaign.totalSpent.toLocaleString()} SAR`],
    ["Offer trigger", campaign.offerTrigger],
    ["Offer reward", campaign.offerReward],
    ["Promo code", campaign.promoCode],
    ["Notes", campaign.notes],
  ];
  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
      {rows
        .filter(([, v]) => v !== null && v !== "")
        .map(([k, v]) => (
          <div key={k} className="card">
            <dt className="eyebrow mb-1">{k}</dt>
            <dd className="text-ink">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

function RolloutsTab({
  campaign,
  onOpenEntry,
}: {
  campaign: CampaignDetail;
  onOpenEntry: (id: string) => void;
}): JSX.Element {
  const rollouts = campaign.campaignBranchRollouts ?? [];
  if (rollouts.length === 0) {
    return <p className="text-[13px] text-ink-3">No branch rollouts on this campaign.</p>;
  }
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-cream-2/50 text-left">
          <tr>
            <th className="px-4 py-3 eyebrow">Branch</th>
            <th className="px-4 py-3 eyebrow">Rollout date</th>
            <th className="px-4 py-3 eyebrow">Lead</th>
            <th className="px-4 py-3 eyebrow">Status</th>
            <th className="px-4 py-3 eyebrow">Calendar entry</th>
          </tr>
        </thead>
        <tbody>
          {rollouts.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="px-4 py-3 font-mono text-[12px] text-ink-2">
                {r.branchId.slice(0, 8)}…
              </td>
              <td className="px-4 py-3">{r.rolloutDate}</td>
              <td className="px-4 py-3">{ASSIGNEE_LABELS[r.leadAssignee] ?? r.leadAssignee}</td>
              <td className="px-4 py-3 capitalize">{r.status}</td>
              <td className="px-4 py-3">
                {r.calendarEntryId ? (
                  <button
                    onClick={() => onOpenEntry(r.calendarEntryId!)}
                    className="text-ink underline underline-offset-2 hover:text-ink"
                  >
                    Open entry
                  </button>
                ) : (
                  <span className="text-ink-3">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContentTab({
  campaignId,
  onOpenEntry,
}: {
  campaignId: string;
  onOpenEntry: (id: string) => void;
}): JSX.Element {
  const entries = useCampaignEntries(campaignId);
  if (entries.isLoading) return <p className="text-[13px] text-ink-3">Loading…</p>;
  if (!entries.data || entries.data.length === 0) {
    return <p className="text-[13px] text-ink-3">No calendar entries linked yet.</p>;
  }
  return (
    <ul className="card p-0 overflow-hidden">
      {entries.data.map((e, idx) => (
        <li
          key={e.id}
          className={`px-4 py-3 flex items-center justify-between text-[13px] ${
            idx > 0 ? "border-t border-line" : ""
          }`}
        >
          <div>
            <div className="font-medium text-ink">{e.title}</div>
            <div className="text-[11.5px] text-ink-3 mt-0.5 capitalize">
              {e.targetDate} · {e.type.replace("_", " ")} · {e.assignee}
            </div>
          </div>
          <button
            onClick={() => onOpenEntry(e.id)}
            className="text-[12px] text-ink underline underline-offset-2"
          >
            Open
          </button>
        </li>
      ))}
    </ul>
  );
}

function AdSpendTab({ campaign }: { campaign: CampaignDetail }): JSX.Element {
  const ads = campaign.campaignAdSpend ?? [];
  if (ads.length === 0) {
    return <p className="text-[13px] text-ink-3">No ad spend lines.</p>;
  }
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-cream-2/50 text-left">
          <tr>
            <th className="px-4 py-3 eyebrow">Platform</th>
            <th className="px-4 py-3 eyebrow">Window</th>
            <th className="px-4 py-3 eyebrow">Objective</th>
            <th className="px-4 py-3 eyebrow text-right">Budget</th>
            <th className="px-4 py-3 eyebrow text-right">Spent</th>
          </tr>
        </thead>
        <tbody>
          {ads.map((a) => (
            <tr key={a.id} className="border-t border-line">
              <td className="px-4 py-3">
                {AD_PLATFORM_LABELS[a.platform as AdPlatform] ?? a.platform}
              </td>
              <td className="px-4 py-3 text-ink-2">
                {a.startDate} → {a.endDate}
              </td>
              <td className="px-4 py-3 text-ink-2">
                {a.objective ? AD_OBJECTIVE_LABELS[a.objective as AdObjective] : "—"}
              </td>
              <td className="px-4 py-3 text-right">{a.budget.toLocaleString()} SAR</td>
              <td className="px-4 py-3 text-right font-semibold">
                {a.spent.toLocaleString()} SAR
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BudgetTab({ campaign }: { campaign: CampaignDetail }): JSX.Element {
  const adBudget = useMemo(
    () => (campaign.campaignAdSpend ?? []).reduce((sum, a) => sum + a.budget, 0),
    [campaign.campaignAdSpend],
  );
  const adSpent = useMemo(
    () => (campaign.campaignAdSpend ?? []).reduce((sum, a) => sum + a.spent, 0),
    [campaign.campaignAdSpend],
  );
  const total = campaign.totalBudget;
  const remaining = Math.max(0, total - campaign.totalSpent);
  const pct = total > 0 ? Math.min(100, (campaign.totalSpent / total) * 100) : 0;
  const fill = pct >= 90 ? "bg-rose-deep" : pct >= 70 ? "bg-yellow" : "bg-sage-deep";

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex justify-between text-[13px] mb-2">
          <span className="text-ink-2">Total spent</span>
          <span>
            <span className="font-semibold">{campaign.totalSpent.toLocaleString()}</span>
            <span className="text-ink-3"> / {total.toLocaleString()} SAR</span>
          </span>
        </div>
        <div className="progress">
          <div className={`progress-fill ${fill}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[11.5px] text-ink-3 mt-1.5">
          {pct.toFixed(0)}% used · {remaining.toLocaleString()} SAR remaining
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card card-cream">
          <div className="eyebrow mb-1">Ad spend allocated</div>
          <div className="font-serif text-[20px] text-ink">
            {adBudget.toLocaleString()} SAR
          </div>
        </div>
        <div className="card card-cream">
          <div className="eyebrow mb-1">Ad spend used</div>
          <div className="font-serif text-[20px] text-ink">
            {adSpent.toLocaleString()} SAR
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsTab({ campaign }: { campaign: CampaignDetail }): JSX.Element {
  if (Object.keys(campaign.results).length === 0) {
    return (
      <p className="text-[13px] text-ink-3">
        No results captured yet. Add JSON results via PATCH or in a follow-up form.
      </p>
    );
  }
  return (
    <pre className="text-[12px] bg-cream-2/50 border border-line rounded-md p-4 overflow-auto font-mono">
      {JSON.stringify(campaign.results, null, 2)}
    </pre>
  );
}

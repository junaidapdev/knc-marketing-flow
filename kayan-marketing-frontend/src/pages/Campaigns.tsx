import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useCurrentBrand } from "../hooks/use-current-brand";
import { useCampaigns } from "../features/campaigns/hooks/use-campaigns";
import { CampaignForm } from "../features/campaigns/CampaignForm";
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
  type CampaignStatus,
  type CampaignType,
} from "../constants/campaign";
import { ROUTES } from "../constants/routes";

const STATUS_FILTERS: ReadonlyArray<{ key: "all" | CampaignStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: CAMPAIGN_STATUSES.PLANNED, label: CAMPAIGN_STATUS_LABELS.planned },
  { key: CAMPAIGN_STATUSES.ACTIVE, label: CAMPAIGN_STATUS_LABELS.active },
  { key: CAMPAIGN_STATUSES.COMPLETED, label: CAMPAIGN_STATUS_LABELS.completed },
  { key: CAMPAIGN_STATUSES.CANCELLED, label: CAMPAIGN_STATUS_LABELS.cancelled },
];

function statusChipClass(status: CampaignStatus): string {
  switch (status) {
    case "active":
      return "status-active";
    case "completed":
      return "status-done";
    case "cancelled":
      return "status-overdue";
    default:
      return "status-planned";
  }
}

export default function CampaignsPage(): JSX.Element {
  const navigate = useNavigate();
  const { brandId } = useCurrentBrand();
  const [filter, setFilter] = useState<"all" | CampaignStatus>("all");
  const [creating, setCreating] = useState(false);

  const campaigns = useCampaigns(filter === "all" ? {} : { status: filter });

  if (creating) {
    return (
      <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12">
        <header className="mb-5 md:mb-6">
          <h1 className="h-greeting text-[24px] md:text-[30px]">
            New <em>campaign</em>
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
            Plan a launch with branch rollouts and ad spend in one place.
          </p>
        </header>
        <CampaignForm
          brandId={brandId}
          onCancel={() => setCreating(false)}
          onCreated={(id) => navigate(ROUTES.CAMPAIGN_DETAIL(id))}
        />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5 md:mb-6">
        <div>
          <h1 className="h-greeting text-[24px] md:text-[30px]">
            Campaigns <em>library</em>
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
            Track every offer, event, and reward push.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn btn-primary">
          <Plus size={14} />
          <span className="hidden sm:inline">New Campaign</span>
          <span className="sm:hidden">New</span>
        </button>
      </header>

      <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0 mb-5">
        <div className="tab-group inline-flex">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`tab ${filter === f.key ? "tab-active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {campaigns.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 mb-4 text-[13px]">
          {campaigns.error instanceof Error
            ? campaigns.error.message
            : "Failed to load campaigns."}
        </div>
      )}
      {campaigns.isLoading && <p className="text-ink-3 text-[13px] py-4">Loading…</p>}
      {campaigns.data && campaigns.data.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-ink-3 text-[13.5px]">
            No campaigns yet. Click "New Campaign" to start.
          </p>
        </div>
      )}

      {campaigns.data && campaigns.data.length > 0 && (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block card p-0 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-cream-2/50 text-left">
                <tr>
                  <th className="px-4 py-3 eyebrow">Name</th>
                  <th className="px-4 py-3 eyebrow">Type</th>
                  <th className="px-4 py-3 eyebrow">Status</th>
                  <th className="px-4 py-3 eyebrow">Window</th>
                  <th className="px-4 py-3 eyebrow text-right">Budget</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.data.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(ROUTES.CAMPAIGN_DETAIL(c.id))}
                    className="cursor-pointer border-t border-line hover:bg-cream-2/30"
                  >
                    <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                    <td className="px-4 py-3 text-ink-2">
                      {CAMPAIGN_TYPE_LABELS[c.campaignType as CampaignType] ?? c.campaignType}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`chip ${statusChipClass(c.status)}`}>
                        {CAMPAIGN_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {c.startDate} → {c.endDate}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2">
                      <span className="font-semibold text-ink">
                        {c.totalSpent.toLocaleString()}
                      </span>{" "}
                      / {c.totalBudget.toLocaleString()} SAR
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden flex flex-col gap-3">
            {campaigns.data.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(ROUTES.CAMPAIGN_DETAIL(c.id))}
                className="card text-left p-4 hover:bg-cream-2/30 transition"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="font-medium text-ink text-[14px] flex-1 min-w-0">{c.name}</div>
                  <span className={`chip ${statusChipClass(c.status)} flex-shrink-0`}>
                    {CAMPAIGN_STATUS_LABELS[c.status]}
                  </span>
                </div>
                <div className="text-[12px] text-ink-2 mb-1">
                  {CAMPAIGN_TYPE_LABELS[c.campaignType as CampaignType] ?? c.campaignType}
                </div>
                <div className="text-[11.5px] text-ink-3 mb-2">
                  {c.startDate} → {c.endDate}
                </div>
                <div className="text-[12px] text-ink-2">
                  <span className="font-semibold text-ink">
                    {c.totalSpent.toLocaleString()}
                  </span>{" "}
                  / {c.totalBudget.toLocaleString()} SAR
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

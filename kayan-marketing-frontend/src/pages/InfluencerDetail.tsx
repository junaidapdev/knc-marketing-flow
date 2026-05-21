import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { ROUTES } from "../constants/routes";
import {
  INFLUENCER_STATUS,
  INFLUENCER_STATUS_LABELS,
  type InfluencerStatus,
} from "../constants/influencer-status";
import { InfluencerFormModal } from "../features/influencers/InfluencerFormModal";
import {
  useDeleteInfluencer,
  useInfluencer,
} from "../features/influencers/hooks/use-influencers";
import {
  ActivityStatsTile,
  CollaborationsTile,
  CommercialsBlock,
  ContactBlock,
  ContentFitBlock,
  NotesTile,
  PlatformsTile,
  PortalManagement,
  ReliabilityTile,
  Tile,
} from "../features/influencers/InfluencerDetailContent";
import {
  getInitials,
  portalUrl,
} from "../features/influencers/utils/influencer-format";
import { highestFollowerCount } from "../constants/influencer-tiers";
import type { InfluencerWithReliability } from "../types/influencer";
import { logger } from "../utils/logger";

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

export default function InfluencerDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useInfluencer(id ?? null);
  const remove = useDeleteInfluencer();
  const [editing, setEditing] = useState(false);

  const onDelete = async (): Promise<void> => {
    if (!detail.data) return;
    const ok = window.confirm(
      `Delete ${detail.data.displayName}? This removes the influencer record.`,
    );
    if (!ok) return;
    try {
      await remove.mutateAsync(detail.data.id);
      navigate(ROUTES.INFLUENCERS);
    } catch (err) {
      logger.error("delete influencer failed", { err: String(err) });
    }
  };

  if (!id) {
    return (
      <div className="px-4 md:px-9 pt-5 md:pt-8 text-rose-deep">
        Missing influencer id.
      </div>
    );
  }

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-7 pb-12">
      <button
        onClick={() => navigate(ROUTES.INFLUENCERS)}
        className="flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink mb-4"
      >
        <ChevronLeft size={14} />
        Back to Influencers
      </button>

      {detail.isLoading && (
        <p className="text-ink-3 text-[13px] py-8">Loading...</p>
      )}
      {detail.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4">
          {detail.error instanceof Error
            ? detail.error.message
            : "Failed to load influencer."}
        </div>
      )}

      {detail.data && (
        <>
          <DetailHeader
            influencer={detail.data}
            onEdit={() => setEditing(true)}
            onDelete={onDelete}
            isDeleting={remove.isPending}
          />

          <div className="mt-5 grid grid-cols-12 gap-3 md:gap-4">
            <Tile className="col-span-12 lg:col-span-8" title="Reliability">
              <ReliabilityTile reliability={detail.data.reliability} />
            </Tile>

            <Tile className="col-span-12 lg:col-span-4" title="Performance">
              <ActivityStatsTile influencerId={detail.data.id} />
            </Tile>

            <Tile className="col-span-12 lg:col-span-7" title="Platforms">
              <PlatformsTile influencer={detail.data} />
            </Tile>

            <Tile
              className="col-span-12 lg:col-span-5"
              title="Portal management"
            >
              <PortalManagement
                influencer={detail.data}
                portalUrl={portalUrl(detail.data.portalToken)}
              />
            </Tile>

            <Tile
              className="col-span-12 md:col-span-6 lg:col-span-4"
              title="Contact"
            >
              <ContactBlock influencer={detail.data} />
            </Tile>

            <Tile
              className="col-span-12 md:col-span-6 lg:col-span-3"
              title="Commercials"
            >
              <CommercialsBlock
                rate={detail.data.standardRate}
                barter={detail.data.acceptsBarter}
                followers={highestFollowerCount(detail.data)}
              />
            </Tile>

            <Tile className="col-span-12 lg:col-span-5" title="Content fit">
              <ContentFitBlock
                nicheTags={detail.data.nicheTags}
                languages={detail.data.languages}
                city={detail.data.city}
              />
            </Tile>

            <Tile className="col-span-12" title="Collaborations">
              <CollaborationsTile influencerId={detail.data.id} />
            </Tile>

            <Tile className="col-span-12" title="Notes">
              <NotesTile influencer={detail.data} />
            </Tile>
          </div>

          <InfluencerFormModal
            isOpen={editing}
            onClose={() => setEditing(false)}
            editing={detail.data}
          />
        </>
      )}
    </div>
  );
}

function DetailHeader({
  influencer,
  onEdit,
  onDelete,
  isDeleting,
}: {
  influencer: InfluencerWithReliability;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}): JSX.Element {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-cream-2 border border-line grid place-items-center text-ink font-serif text-[18px] md:text-[20px] font-semibold flex-shrink-0">
          {getInitials(influencer.displayName)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="h-greeting text-[22px] md:text-[26px] break-words">
              {influencer.displayName}
            </h1>
            <span className={`chip ${statusChipClass(influencer.status)}`}>
              {INFLUENCER_STATUS_LABELS[influencer.status]}
            </span>
          </div>
          <p className="text-[12.5px] md:text-[13px] text-ink-2 mt-0.5">
            {influencer.whatsapp}
            {influencer.city ? ` · ${influencer.city}` : ""}
            {influencer.fullName &&
            influencer.fullName !== influencer.displayName
              ? ` · ${influencer.fullName}`
              : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onEdit} className="btn btn-ghost">
          <Pencil size={14} />
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="px-3 py-2 text-[13px] text-rose-deep hover:brightness-90 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </header>
  );
}

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { INFLUENCER_STATUS_LABELS } from "../../constants/influencer-status";
import {
  classifyTier,
  highestFollowerCount,
  INFLUENCER_TIER_LABELS,
} from "../../constants/influencer-tiers";
import { useDeleteInfluencer, useInfluencer } from "./hooks/use-influencers";
import { InfluencerFormModal } from "./InfluencerFormModal";
import {
  CollaborationsTile,
  CommercialsBlock,
  ContactBlock,
  ContentFitBlock,
  NotesTile,
  PanelStatCards,
  PlatformsTile,
  PortalManagement,
  ReliabilityTile,
  Tile,
} from "./InfluencerDetailContent";
import {
  RELIABILITY_MIN_COLLABS,
  getInitials,
  portalUrl,
  statusBadgeClass,
} from "./utils/influencer-format";
import { splitDisplayName } from "./utils/display-name";
import { toWaUrl } from "./utils/whatsapp";
import { WhatsAppIcon } from "./icons";
import type { InfluencerWithReliability } from "../../types/influencer";
import { logger } from "../../utils/logger";

// Slide-out transition duration (ms). Keep in sync with the duration-300
// Tailwind class on the panel + backdrop below.
const TRANSITION_MS = 300;

interface InfluencerDetailPanelProps {
  influencerId: string;
  onClose: () => void;
}

export function InfluencerDetailPanel({
  influencerId,
  onClose,
}: InfluencerDetailPanelProps): JSX.Element {
  const detail = useInfluencer(influencerId);
  const remove = useDeleteInfluencer();
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClose = useCallback((): void => {
    setShown(false);
    window.setTimeout(onClose, TRANSITION_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !editing) handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose, editing]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onDelete = async (): Promise<void> => {
    if (!detail.data) return;
    const ok = window.confirm(
      `Delete ${detail.data.displayName}? This removes the influencer record.`,
    );
    if (!ok) return;
    try {
      await remove.mutateAsync(detail.data.id);
      handleClose();
    } catch (err) {
      logger.error("delete influencer failed", { err: String(err) });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={`absolute inset-0 bg-obsidian/30 backdrop-blur-sm transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      <aside
        role="dialog"
        aria-label="Influencer detail"
        className={`relative w-full sm:max-w-[600px] h-full bg-warmbg shadow-xl overflow-y-auto canvas-scroll transition-transform duration-300 ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-5 py-3 bg-warmbg/95 backdrop-blur-sm border-b border-line">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="iconbtn"
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
            <span className="eyebrow">Influencer</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="iconbtn"
              aria-label="Edit influencer"
              disabled={!detail.data}
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="iconbtn hover:!text-rose-deep"
              aria-label="Delete influencer"
              disabled={!detail.data || remove.isPending}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {detail.isLoading && (
          <p className="text-ink-3 text-[13px] px-5 py-8">Loading…</p>
        )}
        {detail.isError && (
          <div className="m-4 rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 text-[13px]">
            {detail.error instanceof Error
              ? detail.error.message
              : "Failed to load influencer."}
          </div>
        )}

        {detail.data && (
          <div className="px-4 md:px-5 py-5 space-y-4">
            <PanelHeader influencer={detail.data} />

            <PanelStatCards influencer={detail.data} />

            <ActionRow influencer={detail.data} />

            <Tile
              title="Platforms"
              action={
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-[11.5px] text-ink-3 hover:text-ink font-medium"
                >
                  Manage
                </button>
              }
            >
              <PlatformsTile
                influencer={detail.data}
                onManage={() => setEditing(true)}
              />
            </Tile>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Tile
                title="Reliability"
                action={
                  <span className="text-[11px] text-ink-3 tabular-nums">
                    {Math.min(
                      detail.data.reliability?.totalCollabs ?? 0,
                      RELIABILITY_MIN_COLLABS,
                    )}
                    /{RELIABILITY_MIN_COLLABS} collabs
                  </span>
                }
              >
                <ReliabilityTile reliability={detail.data.reliability} />
              </Tile>
              <Tile title="Commercials">
                <CommercialsBlock
                  rate={detail.data.standardRate}
                  barter={detail.data.acceptsBarter}
                  followers={highestFollowerCount(detail.data)}
                />
              </Tile>
            </div>

            <Tile title="Content fit">
              <ContentFitBlock
                nicheTags={detail.data.nicheTags}
                languages={detail.data.languages}
                city={detail.data.city}
              />
            </Tile>

            <Tile title="Contact">
              <ContactBlock influencer={detail.data} />
            </Tile>

            <Tile title="Portal management">
              <PortalManagement
                influencer={detail.data}
                portalUrl={portalUrl(detail.data.portalToken)}
              />
            </Tile>

            <Tile title="Collaborations">
              <CollaborationsTile influencerId={detail.data.id} />
            </Tile>

            <Tile title="Notes">
              <NotesTile influencer={detail.data} />
            </Tile>
          </div>
        )}

        <InfluencerFormModal
          isOpen={editing}
          onClose={() => setEditing(false)}
          editing={detail.data ?? null}
        />
      </aside>
    </div>,
    document.body,
  );
}

// ─── Panel header ───────────────────────────────────────────────────────

function PanelHeader({
  influencer,
}: {
  influencer: InfluencerWithReliability;
}): JSX.Element {
  const { primaryName, secondaryName } = splitDisplayName(
    influencer.displayName,
  );
  const tier = classifyTier(highestFollowerCount(influencer));
  const totalCollabs = influencer.reliability?.totalCollabs ?? 0;

  return (
    <header className="flex items-start gap-3">
      <div className="w-14 h-14 rounded-2xl bg-yellow grid place-items-center text-obsidian font-serif text-[18px] font-semibold flex-shrink-0">
        {getInitials(primaryName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          {tier && (
            <span className="chip chip-influencer !text-[10px] uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-lavender-deep" />
              {INFLUENCER_TIER_LABELS[tier]}
            </span>
          )}
          <span
            className={`chip ${statusBadgeClass(influencer.status)} !text-[10.5px] font-semibold`}
          >
            {INFLUENCER_STATUS_LABELS[influencer.status]}
          </span>
          {influencer.city && (
            <span className="text-[11.5px] text-ink-3">{influencer.city}</span>
          )}
        </div>
        <h2 className="font-serif text-[21px] font-semibold text-ink leading-tight break-words">
          {primaryName}
        </h2>
        {secondaryName && (
          <p className="text-[12.5px] text-ink-3 mt-0.5" dir="rtl" lang="ar">
            {secondaryName}
          </p>
        )}
      </div>
      <ReliabilityRing collabs={totalCollabs} />
    </header>
  );
}

// SVG progress ring showing collabs-toward-reliability (caps at the min).
function ReliabilityRing({ collabs }: { collabs: number }): JSX.Element {
  const capped = Math.min(collabs, RELIABILITY_MIN_COLLABS);
  const pct = capped / RELIABILITY_MIN_COLLABS;
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  return (
    <div className="flex flex-col items-center flex-shrink-0 text-center w-[64px]">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            strokeWidth="3"
            className="stroke-[var(--c-line-2)]"
          />
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className="stroke-obsidian"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-serif text-[14px] font-bold tabular-nums leading-none text-ink">
            {capped}
            <span className="text-[9px] text-ink-3">/{RELIABILITY_MIN_COLLABS}</span>
          </span>
        </div>
      </div>
      <span className="eyebrow !text-[8px] mt-1 leading-tight">
        Reliability collabs
      </span>
    </div>
  );
}

// ─── Action row ─────────────────────────────────────────────────────────

function ActionRow({
  influencer,
}: {
  influencer: InfluencerWithReliability;
}): JSX.Element {
  return (
    <div className="flex gap-2">
      <a
        href={toWaUrl(influencer.whatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-between gap-2 bg-[#25D366] hover:bg-[#1FBA5A] text-white rounded-full pl-4 pr-3 py-2.5 text-[13px] font-semibold transition"
      >
        <span className="inline-flex items-center gap-2">
          <WhatsAppIcon className="w-4 h-4" />
          WhatsApp
        </span>
        <span className="text-[11.5px] font-normal tabular-nums opacity-90">
          {influencer.whatsapp}
        </span>
      </a>
      <a
        href={portalUrl(influencer.portalToken)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 bg-cream-2 hover:bg-yellow-soft text-ink rounded-full px-4 py-2.5 text-[13px] font-semibold transition flex-shrink-0"
      >
        <ExternalLink size={15} />
        Creator portal
      </a>
    </div>
  );
}

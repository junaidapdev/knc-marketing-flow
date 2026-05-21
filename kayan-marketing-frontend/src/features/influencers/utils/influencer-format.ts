import {
  INFLUENCER_STATUS,
  type InfluencerStatus,
} from "../../../constants/influencer-status";

// Reliability scoring unlocks once a creator has run this many collabs.
export const RELIABILITY_MIN_COLLABS = 3;

// Solid-pastel + dark-text status badge — used by the portal-management
// tile and both detail headers (page + panel).
export function statusBadgeClass(status: InfluencerStatus): string {
  switch (status) {
    case INFLUENCER_STATUS.ACTIVE:
      return "bg-sage text-[#2C5530]";
    case INFLUENCER_STATUS.PAUSED:
      return "bg-yellow text-obsidian";
    case INFLUENCER_STATUS.BLACKLISTED:
      return "bg-rose text-[#6E2A35]";
    default:
      return "bg-cream-2 text-ink-2";
  }
}

// Avatar initials from a display name (first + last word).
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.[0] ?? "?").toUpperCase();
  return (
    (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")
  ).toUpperCase();
}

// Creator portal URL for a given token. Origin-relative so it works in
// dev, preview, and prod without config.
export function portalUrl(token: string): string {
  return `${window.location.origin}/creator/${token}`;
}

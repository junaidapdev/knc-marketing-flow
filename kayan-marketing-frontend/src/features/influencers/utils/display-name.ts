// Display-name format inserted by the 2026-05-20 bulk-load is
// "<English> / <Arabic>". Anything older was free-form text — fall back
// to showing the whole string as the primary line.
//
// Exported here so the InfluencerCard, QuickBookPopover, and CalendarStrip
// all agree on the same parse rule.
export interface SplitDisplayName {
  primaryName: string;
  secondaryName: string | null;
}

export function splitDisplayName(displayName: string): SplitDisplayName {
  const separator = " / ";
  const idx = displayName.indexOf(separator);
  if (idx === -1) {
    return { primaryName: displayName.trim(), secondaryName: null };
  }
  return {
    primaryName: displayName.slice(0, idx).trim(),
    secondaryName: displayName.slice(idx + separator.length).trim(),
  };
}

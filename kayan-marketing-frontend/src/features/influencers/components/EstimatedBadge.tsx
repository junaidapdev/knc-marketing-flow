import { Info } from "lucide-react";

// Small grey pill used wherever the UI shows a value that's an estimate
// from a third-party scraper rather than an authoritative platform
// metric. Hover/tap reveals a short tooltip explaining the source.
//
// Used on:
// - Audience demographics row in ResultCard
// - Header disclaimer strip on the search/saved grids

interface Props {
  // Override the tooltip copy when the surrounding context wants something
  // more specific than the default audience-data line.
  title?: string;
}

const DEFAULT_TITLE =
  "Estimated by third-party scrapers — not from the platform's official analytics.";

export function EstimatedBadge({ title = DEFAULT_TITLE }: Props): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-cream-2 text-ink-3 text-[10.5px] font-medium uppercase tracking-wider"
      title={title}
      aria-label={title}
    >
      <Info size={9} aria-hidden />
      Estimated
    </span>
  );
}

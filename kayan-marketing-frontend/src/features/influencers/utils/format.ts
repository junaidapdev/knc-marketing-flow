// Compact follower-count formatter (480_000 → "480K", 1_240_000 → "1.2M").
// Falls back to a localized integer for anything < 1k.
export function formatFollowerCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)}K`;
  }
  return n.toLocaleString();
}

// Engagement rates land as decimals on the wire (0.054 = 5.4%) but the form
// + UI talk percentages (5.4). This wrapper formats either form for display.
export function formatEngagementRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—";
  // Treat values <= 1 as decimal fractions, > 1 as already a percent.
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${pct >= 10 ? pct.toFixed(1) : pct.toFixed(2)}%`;
}

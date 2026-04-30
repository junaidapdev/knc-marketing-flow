import type { Branch } from "../../../types/branch";

// Stable city ordering used by selectors and grouped lists.
const CITY_ORDER: readonly string[] = ["Makkah", "Jeddah", "Madina", "Other"];

export function groupBranchesByCity(branches: Branch[]): Array<{ city: string; items: Branch[] }> {
  const map = new Map<string, Branch[]>();
  for (const b of branches) {
    const list = map.get(b.city);
    if (list) list.push(b);
    else map.set(b.city, [b]);
  }
  // Cities that appear in our canonical order come first; anything else gets appended.
  const ordered: Array<{ city: string; items: Branch[] }> = [];
  const seen = new Set<string>();
  for (const city of CITY_ORDER) {
    const items = map.get(city);
    if (items && items.length > 0) {
      ordered.push({ city, items });
      seen.add(city);
    }
  }
  for (const [city, items] of map.entries()) {
    if (!seen.has(city)) ordered.push({ city, items });
  }
  return ordered;
}

export function formatBranchLabel(branch: Pick<Branch, "name" | "city">): string {
  return `${branch.name} — ${branch.city}`;
}

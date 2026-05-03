import { useMemo } from "react";
import type { Branch } from "../../types/branch";
import { groupBranchesByCity } from "../branches/utils/branch-helpers";

interface Props {
  branches: Branch[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

// Multi-select branch list grouped by city. Renders as a scrollable
// checkbox list with quick "Select all" / "Deselect all" actions. Used in
// the product create/edit form to pick which branches stock the product.
export function ProductBranchSelector({ branches, selectedIds, onChange }: Props): JSX.Element {
  const grouped = useMemo(() => groupBranchesByCity(branches), [branches]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = branches.length > 0 && selected.size === branches.length;

  const toggle = (id: string): void => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const selectAll = (): void => onChange(branches.map((b) => b.id));
  const deselectAll = (): void => onChange([]);

  return (
    <div className="border border-line rounded-md bg-paper">
      <div className="flex items-center justify-between px-3 py-2 border-b border-line">
        <span className="text-[12px] text-ink-2">
          {selected.size} of {branches.length} selected
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={selectAll}
            disabled={allSelected}
            className="text-[11.5px] text-ink-2 hover:text-ink underline-offset-2 hover:underline disabled:opacity-40"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={deselectAll}
            disabled={selected.size === 0}
            className="text-[11.5px] text-ink-2 hover:text-ink underline-offset-2 hover:underline disabled:opacity-40"
          >
            Deselect all
          </button>
        </div>
      </div>
      <div className="max-h-[260px] overflow-y-auto canvas-scroll p-2 space-y-2">
        {grouped.map((group) => (
          <div key={group.city}>
            <div className="eyebrow px-1 py-1">{group.city}</div>
            <ul className="space-y-0.5">
              {group.items.map((b) => {
                const checked = selected.has(b.id);
                return (
                  <li key={b.id}>
                    <label className="flex items-center gap-2 px-2 py-1 rounded-sm hover:bg-cream-2/40 cursor-pointer text-[12.5px]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(b.id)}
                        className="rounded-sm accent-obsidian"
                      />
                      <span className="text-ink">{b.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {branches.length === 0 && (
          <p className="text-[12px] text-ink-3 italic px-2 py-3">
            No branches loaded.
          </p>
        )}
      </div>
    </div>
  );
}

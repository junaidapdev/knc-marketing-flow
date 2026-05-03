import { useEffect, useState } from "react";
import { X, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import {
  useProductCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "./hooks";
import type { ProductCategory } from "./types";
import { logger } from "../../utils/logger";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface DraftRow {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  isDirty: boolean;
}

// Inline-edit list of categories. Each row is independently saveable —
// keeps the UX snappy for small edits without a giant batched submit.
export function CategoryManagerModal({ isOpen, onClose }: Props): JSX.Element | null {
  const list = useProductCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();

  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setNewName("");
    if (!list.data) return;
    const next: Record<string, DraftRow> = {};
    for (const c of list.data) {
      next[c.id] = {
        id: c.id,
        name: c.name,
        description: c.description ?? "",
        displayOrder: c.displayOrder,
        isActive: c.isActive,
        isDirty: false,
      };
    }
    setDrafts(next);
  }, [isOpen, list.data]);

  const setRow = (id: string, patch: Partial<DraftRow>): void => {
    setDrafts((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, ...patch, isDirty: true } };
    });
  };

  const saveRow = async (row: DraftRow): Promise<void> => {
    setError(null);
    try {
      await update.mutateAsync({
        id: row.id,
        input: {
          name: row.name.trim(),
          description: row.description.trim() || null,
          displayOrder: row.displayOrder,
          isActive: row.isActive,
        },
      });
      setDrafts((prev) => {
        const existing = prev[row.id];
        if (!existing) return prev;
        return { ...prev, [row.id]: { ...existing, isDirty: false } };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      setError(message);
      logger.error("category save failed", { err: String(err), id: row.id });
    }
  };

  // Backend blocks delete when active products still reference the category
  // (returns 409). We surface that error inline.
  const deleteRow = async (row: DraftRow): Promise<void> => {
    const ok = window.confirm(
      `Archive category "${row.name}"? Products using it will be untagged. Active products block this — reassign first.`,
    );
    if (!ok) return;
    setError(null);
    try {
      await remove.mutateAsync(row.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed.";
      setError(message);
    }
  };

  const onAdd = async (): Promise<void> => {
    const name = newName.trim();
    if (name.length === 0) return;
    setError(null);
    try {
      const next = list.data
        ? Math.max(0, ...list.data.map((c) => c.displayOrder)) + 1
        : 0;
      await create.mutateAsync({ name, displayOrder: next });
      setNewName("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed.";
      setError(message);
    }
  };

  if (!isOpen) return null;

  const categories = list.data ?? [];
  const sorted: ProductCategory[] = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-paper rounded-lg shadow-lg text-ink max-h-[95vh] sm:max-h-[90vh] overflow-y-auto canvas-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-line sticky top-0 bg-paper z-10">
          <div>
            <h2 className="font-serif text-[20px] tracking-tight text-ink">
              Manage categories
            </h2>
            <p className="text-[12px] text-ink-3 mt-0.5">
              Order, rename, archive. Each row saves independently.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-3">
          {list.isLoading && <p className="text-ink-3 text-[13px]">Loading…</p>}
          {error && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-3 text-[12.5px] flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {sorted.map((c) => {
            const draft = drafts[c.id];
            if (!draft) return null;
            return (
              <div
                key={c.id}
                className={`rounded-md border p-3 space-y-2 ${
                  draft.isActive ? "border-line" : "border-line opacity-60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={draft.displayOrder}
                    onChange={(e) =>
                      setRow(c.id, { displayOrder: Number(e.target.value) || 0 })
                    }
                    min={0}
                    max={1000}
                    className="w-14 form-input !py-1 !text-[12px] text-center"
                    title="Display order"
                  />
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setRow(c.id, { name: e.target.value })}
                    className="form-input !py-1 flex-1"
                  />
                  <label className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(e) => setRow(c.id, { isActive: e.target.checked })}
                      className="accent-obsidian"
                    />
                    Active
                  </label>
                </div>
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setRow(c.id, { description: e.target.value })}
                  placeholder="Description (optional)"
                  className="form-input !py-1 !text-[12.5px]"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => deleteRow(draft)}
                    className="text-[12px] text-rose-deep hover:underline px-2 py-1 inline-flex items-center gap-1"
                  >
                    <Trash2 size={11} />
                    Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => saveRow(draft)}
                    disabled={!draft.isDirty || update.isPending}
                    className="text-[12px] btn btn-primary !py-1 !px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save row
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add new */}
          <div className="rounded-md border border-dashed border-line-2 p-3 flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onAdd();
                }
              }}
              placeholder="New category name"
              className="form-input !py-1 flex-1"
            />
            <button
              type="button"
              onClick={onAdd}
              disabled={newName.trim().length === 0 || create.isPending}
              className="btn btn-ghost !py-1 !px-3 disabled:opacity-40"
            >
              {create.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

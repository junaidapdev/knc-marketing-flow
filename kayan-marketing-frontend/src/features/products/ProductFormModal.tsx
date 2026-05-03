import { useEffect, useState, type KeyboardEvent } from "react";
import { X, Plus, Loader2, AlertCircle } from "lucide-react";
import {
  PRICE_TIERS,
  PRICE_TIER_LABELS,
  type Product,
  type CreateProductInput,
  type PriceTier,
} from "./types";
import { useProductCategories, useCreateProduct, useUpdateProduct } from "./hooks";
import { useBranches } from "../branches/hooks/use-branches";
import { useCurrentBrand } from "../../hooks/use-current-brand";
import { ProductBranchSelector } from "./ProductBranchSelector";
import { logger } from "../../utils/logger";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // When provided, edits this product. When null, creates a new one.
  editing: Product | null;
}

interface FormState {
  name: string;
  manufacturer: string;
  description: string;
  categoryId: string;
  priceTier: PriceTier;
  isHero: boolean;
  isTrending: boolean;
  marketingNotes: string;
  tags: string[];
  branchIds: string[];
}

const EMPTY: FormState = {
  name: "",
  manufacturer: "",
  description: "",
  categoryId: "",
  priceTier: "anchor",
  isHero: false,
  isTrending: false,
  marketingNotes: "",
  tags: [],
  branchIds: [],
};

const TIER_HELPER: Record<PriceTier, string> = {
  anchor: "11.50 SR fixed-price line — most products",
  premium: "Premium products like boxed chocolates",
  bulk: "Multi-pack bundles (24+4, etc.)",
  open_price: "Variable / comparison products",
};

export function ProductFormModal({ isOpen, onClose, editing }: Props): JSX.Element | null {
  const { brandId } = useCurrentBrand();
  const categoriesQ = useProductCategories();
  const branchesQ = useBranches(brandId);
  const create = useCreateProduct();
  const update = useUpdateProduct();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [tagDraft, setTagDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset / hydrate form whenever the modal opens or the editing target
  // changes. Branches default to "all branches" on create — typical case
  // for anchor-tier products.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setTagDraft("");
    if (editing) {
      setForm({
        name: editing.name,
        manufacturer: editing.manufacturer ?? "",
        description: editing.description ?? "",
        categoryId: editing.categoryId ?? "",
        priceTier: editing.priceTier,
        isHero: editing.isHeroProduct,
        isTrending: editing.isTrending,
        marketingNotes: editing.marketingNotes ?? "",
        tags: editing.tags ?? [],
        branchIds: (editing.branches ?? [])
          .filter((b) => b.isInStock !== false)
          .map((b) => b.branchId),
      });
    } else {
      setForm({ ...EMPTY, branchIds: branchesQ.data?.map((b) => b.id) ?? [] });
    }
  }, [isOpen, editing, branchesQ.data]);

  const update_ = <K extends keyof FormState>(key: K, value: FormState[K]): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Tag chips: type → Enter/comma → push to list. Backspace on empty input
  // pops the last tag (matches the standard chip-input pattern).
  const onTagKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if ((e.key === "Enter" || e.key === ",") && tagDraft.trim().length > 0) {
      e.preventDefault();
      const next = tagDraft.trim().toLowerCase().slice(0, 40);
      if (!form.tags.includes(next) && form.tags.length < 20) {
        update_("tags", [...form.tags, next]);
      }
      setTagDraft("");
    } else if (e.key === "Backspace" && tagDraft.length === 0 && form.tags.length > 0) {
      update_("tags", form.tags.slice(0, -1));
    }
  };

  const removeTag = (t: string): void => update_("tags", form.tags.filter((x) => x !== t));

  const isPending = create.isPending || update.isPending;
  const canSubmit = form.name.trim().length > 0 && !isPending;

  const onSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setError(null);
    const payload: CreateProductInput = {
      name: form.name.trim(),
      manufacturer: form.manufacturer.trim() || null,
      description: form.description.trim() || null,
      categoryId: form.categoryId || null,
      priceTier: form.priceTier,
      isHeroProduct: form.isHero,
      isTrending: form.isTrending,
      marketingNotes: form.marketingNotes.trim() || null,
      tags: form.tags,
      branchIds: form.branchIds,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      setError(message);
      logger.error("product save failed", { err: String(err) });
    }
  };

  const categories = categoriesQ.data ?? [];
  const branches = branchesQ.data ?? [];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={isPending ? undefined : onClose}
    >
      <div
        className="w-full max-w-2xl bg-paper rounded-lg shadow-lg text-ink max-h-[95vh] sm:max-h-[90vh] overflow-y-auto canvas-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-line sticky top-0 bg-paper z-10">
          <div>
            <h2 className="font-serif text-[20px] tracking-tight text-ink">
              {editing ? "Edit product" : "Add product"}
            </h2>
            <p className="text-[12px] text-ink-3 mt-0.5">
              The AI Generate flow injects matching products by name into every script.
            </p>
          </div>
          <button onClick={onClose} disabled={isPending} aria-label="Close" className="iconbtn disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-4">
          <div>
            <label className="field-label">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update_("name", e.target.value)}
              maxLength={200}
              placeholder="e.g., Tiffany Toffees"
              className="form-input"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Category</label>
              <select
                value={form.categoryId}
                onChange={(e) => update_("categoryId", e.target.value)}
                className="form-select"
              >
                <option value="">— uncategorized —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Manufacturer</label>
              <input
                type="text"
                value={form.manufacturer}
                onChange={(e) => update_("manufacturer", e.target.value)}
                maxLength={200}
                placeholder="e.g., Tiffany"
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => update_("description", e.target.value)}
              rows={2}
              className="form-textarea"
            />
          </div>

          <div>
            <label className="field-label">Price tier</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRICE_TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update_("priceTier", t)}
                  className={`text-left px-3 py-2 rounded-md border transition ${
                    form.priceTier === t
                      ? "border-obsidian bg-cream-2"
                      : "border-line hover:border-ink-3"
                  }`}
                >
                  <div className="text-[12.5px] font-semibold text-ink">{PRICE_TIER_LABELS[t]}</div>
                  <div className="text-[11px] text-ink-3 mt-0.5">{TIER_HELPER[t]}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-md border border-line cursor-pointer hover:bg-cream-2/40">
              <input
                type="checkbox"
                checked={form.isHero}
                onChange={(e) => update_("isHero", e.target.checked)}
                className="mt-0.5 accent-obsidian"
              />
              <div>
                <div className="text-[12.5px] font-semibold text-ink">★ Hero product</div>
                <div className="text-[11px] text-ink-3 mt-0.5">
                  AI emphasizes this in scripts.
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-md border border-line cursor-pointer hover:bg-cream-2/40">
              <input
                type="checkbox"
                checked={form.isTrending}
                onChange={(e) => update_("isTrending", e.target.checked)}
                className="mt-0.5 accent-obsidian"
              />
              <div>
                <div className="text-[12.5px] font-semibold text-ink">🔥 Trending</div>
                <div className="text-[11px] text-ink-3 mt-0.5">
                  Mark as currently viral or new.
                </div>
              </div>
            </label>
          </div>

          <div>
            <label className="field-label">Marketing notes</label>
            <textarea
              value={form.marketingNotes}
              onChange={(e) => update_("marketingNotes", e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder='e.g., "Korean section, viral on TikTok"'
              className="form-textarea"
            />
            <p className="text-[11px] text-ink-3 mt-1 italic">
              Free-form context the AI uses when deciding how to mention this product.
            </p>
          </div>

          <div>
            <label className="field-label">Tags</label>
            <div className="flex flex-wrap items-center gap-1.5 px-2 py-2 rounded-md border border-line bg-paper min-h-[42px]">
              {form.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 text-[11.5px] px-2 py-0.5 rounded-full bg-cream-2 text-ink-2"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    aria-label={`Remove ${t}`}
                    className="hover:text-rose-deep"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={onTagKeyDown}
                placeholder={form.tags.length === 0 ? "imported, sour, kids, ramadan…" : ""}
                className="flex-1 min-w-[120px] bg-transparent outline-none text-[12.5px] text-ink"
              />
            </div>
            <p className="text-[11px] text-ink-3 mt-1 italic">
              Press Enter or comma to add. Used by AI to match the entry's theme.
            </p>
          </div>

          <div>
            <label className="field-label">Available at branches</label>
            <ProductBranchSelector
              branches={branches}
              selectedIds={form.branchIds}
              onChange={(ids) => update_("branchIds", ids)}
            />
          </div>

          {error && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-3 text-[12.5px] flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-4 border-t border-line sticky bottom-0 bg-paper">
          <button onClick={onClose} disabled={isPending} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="btn btn-primary disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Plus size={14} />
                {editing ? "Save changes" : "Add product"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

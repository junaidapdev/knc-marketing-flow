import { useMemo, useState } from "react";
import { Plus, Search, FolderTree, Sparkles, Flame, MapPin, Package } from "lucide-react";
import { useProducts, useProductCategories } from "./hooks";
import { useBranches } from "../branches/hooks/use-branches";
import { useCurrentBrand } from "../../hooks/use-current-brand";
import { ProductFormModal } from "./ProductFormModal";
import { CategoryManagerModal } from "./CategoryManagerModal";
import { PRICE_TIER_LABELS, type Product, type ProductFilters } from "./types";

const TIER_CHIP_CLASS: Record<string, string> = {
  anchor: "bg-yellow text-obsidian",
  premium: "bg-lavender text-[#4A3A6A]",
  bulk: "bg-peach text-[#7A3520]",
  open_price: "bg-sky text-[#2C4A66]",
};

export function ProductsSection(): JSX.Element {
  const { brandId } = useCurrentBrand();
  const branchesQ = useBranches(brandId);
  const categoriesQ = useProductCategories();

  const [filters, setFilters] = useState<ProductFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const productsQ = useProducts({ ...filters, search: searchInput || undefined });

  const branchById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of branchesQ.data ?? []) map.set(b.id, b.name);
    return map;
  }, [branchesQ.data]);

  const totalBranches = branchesQ.data?.length ?? 0;

  const openNew = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (p: Product): void => {
    setEditing(p);
    setFormOpen(true);
  };

  const products = productsQ.data ?? [];
  const isFiltered =
    !!filters.categoryId ||
    !!filters.branchId ||
    !!filters.isTrending ||
    !!filters.isHero ||
    !!searchInput;

  return (
    <>
      <div className="space-y-5">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="h-card">Products catalog</h2>
            <p className="text-[12.5px] text-ink-3 mt-0.5">
              The marketing AI references real products from this list. Branch
              availability filters which products show up in scripts for each
              branch's reels.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCategoryManagerOpen(true)}
              className="btn btn-ghost"
            >
              <FolderTree size={13} />
              Manage categories
            </button>
            <button type="button" onClick={openNew} className="btn btn-primary">
              <Plus size={13} />
              Add product
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="search-bar !w-auto !flex-1 max-w-[280px]">
            <Search size={14} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name or manufacturer…"
            />
          </div>
          <select
            value={filters.categoryId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, categoryId: e.target.value || undefined }))
            }
            className="form-select !py-1.5 !text-[12.5px] !w-auto"
          >
            <option value="">Any category</option>
            {(categoriesQ.data ?? [])
              .filter((c) => c.isActive)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <select
            value={filters.branchId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, branchId: e.target.value || undefined }))
            }
            className="form-select !py-1.5 !text-[12.5px] !w-auto"
          >
            <option value="">Any branch</option>
            {(branchesQ.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.city})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-ink-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-cream-2/40">
            <input
              type="checkbox"
              checked={!!filters.isHero}
              onChange={(e) =>
                setFilters((f) => ({ ...f, isHero: e.target.checked || undefined }))
              }
              className="accent-obsidian"
            />
            ★ Hero
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-ink-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-cream-2/40">
            <input
              type="checkbox"
              checked={!!filters.isTrending}
              onChange={(e) =>
                setFilters((f) => ({ ...f, isTrending: e.target.checked || undefined }))
              }
              className="accent-obsidian"
            />
            🔥 Trending
          </label>
          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setFilters({});
                setSearchInput("");
              }}
              className="text-[12px] text-ink-3 hover:text-ink underline-offset-2 hover:underline"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-[12px] text-ink-3">
            {productsQ.isLoading ? "Loading…" : `${products.length} product${products.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {productsQ.isError && (
          <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 text-[13px]">
            {productsQ.error instanceof Error ? productsQ.error.message : "Failed to load products."}
          </div>
        )}

        {!productsQ.isLoading && products.length === 0 && (
          <div className="text-center py-12 text-ink-3 text-[13px]">
            <Package size={26} className="mx-auto mb-3 text-ink-3" />
            {isFiltered ? "No products match these filters." : "No products yet. Click Add product to start."}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {products.map((p) => {
            const inStockBranchIds = (p.branches ?? [])
              .filter((b) => b.isInStock !== false)
              .map((b) => b.branchId);
            const branchCount = inStockBranchIds.length;
            const allBranches = branchCount === totalBranches && totalBranches > 0;
            const branchPreview = allBranches
              ? `All ${totalBranches} branches`
              : branchCount === 0
                ? "No branches selected"
                : `${branchCount} of ${totalBranches} branches`;

            return (
              <article
                key={p.id}
                className={`card hover:border-line-2 transition ${p.isActive ? "" : "opacity-60"}`}
              >
                <header className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-[16px] tracking-tight text-ink leading-tight truncate">
                      {p.name}
                    </h3>
                    <div className="text-[12px] text-ink-3 mt-0.5">
                      {p.category?.name ?? "Uncategorized"}
                      {p.manufacturer ? ` · ${p.manufacturer}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="text-[12px] text-ink-2 hover:text-ink underline-offset-2 hover:underline px-2"
                  >
                    Edit
                  </button>
                </header>

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span
                    className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${TIER_CHIP_CLASS[p.priceTier] ?? "bg-cream-2 text-ink-2"}`}
                  >
                    {PRICE_TIER_LABELS[p.priceTier]}
                  </span>
                  {p.isHeroProduct && (
                    <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-yellow text-obsidian font-bold flex items-center gap-1">
                      <Sparkles size={9} />
                      HERO
                    </span>
                  )}
                  {p.isTrending && (
                    <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-rose text-[#6E2A35] font-bold flex items-center gap-1">
                      <Flame size={9} />
                      TRENDING
                    </span>
                  )}
                  {!p.isActive && (
                    <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-cream-2 text-ink-3">
                      Archived
                    </span>
                  )}
                </div>

                {p.marketingNotes && (
                  <p className="text-[12px] text-ink-2 italic mt-2.5">
                    "{p.marketingNotes}"
                  </p>
                )}

                <div className="text-[11.5px] text-ink-3 mt-3 flex items-center gap-1.5">
                  <MapPin size={11} />
                  <span>{branchPreview}</span>
                  {!allBranches && branchCount > 0 && branchCount <= 4 && (
                    <span className="text-ink-3">
                      ({inStockBranchIds.map((id) => branchById.get(id) ?? "?").join(", ")})
                    </span>
                  )}
                </div>

                {p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10.5px] px-1.5 py-0.5 rounded bg-cream-2 text-ink-3"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <ProductFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <CategoryManagerModal
        isOpen={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
      />
    </>
  );
}

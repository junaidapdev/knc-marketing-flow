import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABELS,
  type BudgetCategory,
} from "../../constants/budget-categories";
import { useUpsertBudgetCap } from "./hooks/use-budget";
import type { BudgetCap } from "../../types/budget";
import { logger } from "../../utils/logger";

const CATEGORY_VALUES = Object.values(BUDGET_CATEGORIES) as BudgetCategory[];

const formSchema = z.object({
  totalCap: z.coerce.number().positive("Total cap must be positive."),
  ad_spend_tiktok: z.coerce.number().nonnegative(),
  ad_spend_snap: z.coerce.number().nonnegative(),
  ad_spend_ig: z.coerce.number().nonnegative(),
  influencer: z.coerce.number().nonnegative(),
  shop_materials: z.coerce.number().nonnegative(),
  production: z.coerce.number().nonnegative(),
  other: z.coerce.number().nonnegative(),
});

type FormInput = z.infer<typeof formSchema>;

interface Props {
  brandId: string;
  month: string;
  isOpen: boolean;
  onClose: () => void;
  existing: BudgetCap | null;
}

export function EditBudgetModal({
  brandId,
  month,
  isOpen,
  onClose,
  existing,
}: Props): JSX.Element | null {
  const upsert = useUpsertBudgetCap();

  const defaults: FormInput = {
    totalCap: existing?.totalCap ?? 0,
    ad_spend_tiktok: existing?.categoryCaps?.ad_spend_tiktok ?? 0,
    ad_spend_snap: existing?.categoryCaps?.ad_spend_snap ?? 0,
    ad_spend_ig: existing?.categoryCaps?.ad_spend_ig ?? 0,
    influencer: existing?.categoryCaps?.influencer ?? 0,
    shop_materials: existing?.categoryCaps?.shop_materials ?? 0,
    production: existing?.categoryCaps?.production ?? 0,
    other: existing?.categoryCaps?.other ?? 0,
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (isOpen) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, existing?.id]);

  const onSubmit = async (input: FormInput): Promise<void> => {
    try {
      await upsert.mutateAsync({
        brandId,
        month,
        totalCap: input.totalCap,
        categoryCaps: {
          ad_spend_tiktok: input.ad_spend_tiktok,
          ad_spend_snap: input.ad_spend_snap,
          ad_spend_ig: input.ad_spend_ig,
          influencer: input.influencer,
          shop_materials: input.shop_materials,
          production: input.production,
          other: input.other,
        },
      });
      onClose();
    } catch (err) {
      logger.error("upsert budget cap failed", { err: String(err) });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-paper rounded-lg shadow-lg text-ink max-h-[90vh] overflow-y-auto canvas-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-serif text-[18px] tracking-tight text-ink">
            Edit budget · {month.slice(0, 7)}
          </h2>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-5 space-y-3">
          <Field label="Total cap (SAR)" error={errors.totalCap?.message}>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register("totalCap")}
              className="form-input"
            />
          </Field>

          <div className="eyebrow pt-2">Per-category caps</div>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORY_VALUES.map((cat) => (
              <Field key={cat} label={BUDGET_CATEGORY_LABELS[cat]}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register(cat)}
                  className="form-input"
                />
              </Field>
            ))}
          </div>

          {upsert.isError && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-3 py-2 text-[12.5px]">
              {upsert.error instanceof Error ? upsert.error.message : "Failed to save."}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || upsert.isPending}
              className="btn btn-primary disabled:opacity-50"
            >
              {upsert.isPending ? "Saving…" : "Save budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {error && <p className="text-rose-deep text-[12px] mt-1.5">{error}</p>}
    </div>
  );
}

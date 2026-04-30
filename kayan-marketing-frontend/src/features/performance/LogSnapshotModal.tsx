import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
} from "../../constants/social-platform";
import { useUpsertSnapshot } from "./hooks/use-performance-snapshots";
import { logger } from "../../utils/logger";

const PLATFORM_VALUES = Object.values(SOCIAL_PLATFORMS) as [SocialPlatform, ...SocialPlatform[]];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const formSchema = z.object({
  snapshotDate: z.string().regex(DATE_REGEX, "Date is required."),
  platform: z.enum(PLATFORM_VALUES),
  followers: z.coerce.number().int().nonnegative().optional(),
  totalViews: z.coerce.number().int().nonnegative().optional(),
  totalLikes: z.coerce.number().int().nonnegative().optional(),
  totalComments: z.coerce.number().int().nonnegative().optional(),
  totalShares: z.coerce.number().int().nonnegative().optional(),
  reach: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().max(5000).optional(),
});

type FormInput = z.infer<typeof formSchema>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  brandId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LogSnapshotModal({ brandId, isOpen, onClose }: Props): JSX.Element | null {
  const upsert = useUpsertSnapshot();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      snapshotDate: todayIso(),
      platform: SOCIAL_PLATFORMS.TIKTOK,
      notes: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        snapshotDate: todayIso(),
        platform: SOCIAL_PLATFORMS.TIKTOK,
        notes: "",
      });
    }
  }, [isOpen, reset]);

  const onSubmit = async (input: FormInput): Promise<void> => {
    try {
      await upsert.mutateAsync({
        brandId,
        snapshotDate: input.snapshotDate,
        platform: input.platform,
        followers: input.followers ?? null,
        totalViews: input.totalViews ?? null,
        totalLikes: input.totalLikes ?? null,
        totalComments: input.totalComments ?? null,
        totalShares: input.totalShares ?? null,
        reach: input.reach ?? null,
        notes: input.notes?.trim() ? input.notes : null,
      });
      onClose();
    } catch (err) {
      logger.error("snapshot upsert failed", { err: String(err) });
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
            Log weekly snapshot
          </h2>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" error={errors.snapshotDate?.message}>
              <input
                type="date"
                {...register("snapshotDate")}
                className="form-input"
              />
            </Field>
            <Field label="Platform">
              <select
                {...register("platform")}
                className="form-select"
              >
                {PLATFORM_VALUES.map((p) => (
                  <option key={p} value={p}>
                    {SOCIAL_PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Followers">
              <input
                type="number"
                min="0"
                {...register("followers")}
                className="form-input"
              />
            </Field>
            <Field label="Total views">
              <input
                type="number"
                min="0"
                {...register("totalViews")}
                className="form-input"
              />
            </Field>
            <Field label="Total likes">
              <input
                type="number"
                min="0"
                {...register("totalLikes")}
                className="form-input"
              />
            </Field>
            <Field label="Total comments">
              <input
                type="number"
                min="0"
                {...register("totalComments")}
                className="form-input"
              />
            </Field>
            <Field label="Total shares">
              <input
                type="number"
                min="0"
                {...register("totalShares")}
                className="form-input"
              />
            </Field>
            <Field label="Reach">
              <input
                type="number"
                min="0"
                {...register("reach")}
                className="form-input"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea rows={2} {...register("notes")} className="form-textarea" />
          </Field>

          {upsert.isError && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-3 py-2 text-[12.5px]">
              {upsert.error instanceof Error ? upsert.error.message : "Failed to save snapshot."}
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
              {upsert.isPending ? "Saving…" : "Save snapshot"}
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

import { useState, type ReactNode } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import {
  CAMPAIGN_TYPES,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_STATUSES,
  AD_PLATFORMS,
  AD_PLATFORM_LABELS,
  AD_OBJECTIVES,
  AD_OBJECTIVE_LABELS,
  type CampaignType,
  type AdPlatform,
  type AdObjective,
} from "../../constants/campaign";
import { ASSIGNEE_VALUES, ASSIGNEE_LABELS } from "../../constants/task-chains";
import { useBranches } from "../branches/hooks/use-branches";
import { useCreateCampaign, type CreateCampaignInput } from "./hooks/use-campaigns";
import { logger } from "../../utils/logger";

const CAMPAIGN_TYPE_VALUES = Object.values(CAMPAIGN_TYPES) as [CampaignType, ...CampaignType[]];
const AD_PLATFORM_VALUES = Object.values(AD_PLATFORMS) as [AdPlatform, ...AdPlatform[]];
const AD_OBJECTIVE_VALUES = Object.values(AD_OBJECTIVES) as [AdObjective, ...AdObjective[]];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const rolloutSchema = z.object({
  branchId: z.string().uuid("Branch is required."),
  branchName: z.string().min(1),
  rolloutDate: z.string().regex(DATE_REGEX, "Date is required."),
  leadAssignee: z.enum(ASSIGNEE_VALUES),
  notes: z.string().optional(),
});

const adLineSchema = z
  .object({
    platform: z.enum(AD_PLATFORM_VALUES),
    startDate: z.string().regex(DATE_REGEX),
    endDate: z.string().regex(DATE_REGEX),
    budget: z.coerce.number().nonnegative(),
    objective: z.enum(AD_OBJECTIVE_VALUES).optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date.",
    path: ["endDate"],
  });

const formSchema = z
  .object({
    name: z.string().min(3, "Name must be at least 3 characters.").max(200),
    campaignType: z.enum(CAMPAIGN_TYPE_VALUES),
    startDate: z.string().regex(DATE_REGEX, "Start date is required."),
    endDate: z.string().regex(DATE_REGEX, "End date is required."),
    totalBudget: z.coerce.number().nonnegative(),
    offerTrigger: z.string().max(500).optional(),
    offerReward: z.string().max(500).optional(),
    promoCode: z.string().max(50).optional(),
    notes: z.string().max(5000).optional(),
    rollouts: z.array(rolloutSchema),
    adLines: z.array(adLineSchema),
    autoCreateEntries: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after start date.",
      });
    }
    data.rollouts.forEach((r, i) => {
      if (r.rolloutDate < data.startDate || r.rolloutDate > data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rollouts", i, "rolloutDate"],
          message: "Rollout date must be within the campaign window.",
        });
      }
    });
    data.adLines.forEach((a, i) => {
      if (a.startDate < data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["adLines", i, "startDate"],
          message: "Ad start must be within campaign window.",
        });
      }
      if (a.endDate > data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["adLines", i, "endDate"],
          message: "Ad end must be within campaign window.",
        });
      }
    });
  });

type FormInput = z.infer<typeof formSchema>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Props {
  brandId: string;
  onCreated: (campaignId: string) => void;
  onCancel: () => void;
}

export function CampaignForm({ brandId, onCreated, onCancel }: Props): JSX.Element {
  const branches = useBranches(brandId);
  const createCampaign = useCreateCampaign();

  const start = todayIso();
  const end = plusDaysIso(start, 14);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      campaignType: CAMPAIGN_TYPES.OFFER,
      startDate: start,
      endDate: end,
      totalBudget: 0,
      offerTrigger: "",
      offerReward: "",
      promoCode: "",
      notes: "",
      rollouts: [],
      adLines: [],
      autoCreateEntries: true,
    },
  });

  const rolloutsArr = useFieldArray({ control, name: "rollouts" });
  const adLinesArr = useFieldArray({ control, name: "adLines" });

  const watchedStart = watch("startDate");

  const onSubmit = async (input: FormInput): Promise<void> => {
    try {
      const payload: CreateCampaignInput = {
        brandId,
        name: input.name,
        campaignType: input.campaignType,
        status: CAMPAIGN_STATUSES.PLANNED,
        startDate: input.startDate,
        endDate: input.endDate,
        totalBudget: input.totalBudget,
        offerTrigger: input.offerTrigger?.trim() ? input.offerTrigger : null,
        offerReward: input.offerReward?.trim() ? input.offerReward : null,
        promoCode: input.promoCode?.trim() ? input.promoCode : null,
        notes: input.notes?.trim() ? input.notes : null,
        branchRollouts: input.rollouts.map((r) => ({
          branchId: r.branchId,
          branchName: r.branchName,
          rolloutDate: r.rolloutDate,
          leadAssignee: r.leadAssignee,
          notes: r.notes?.trim() ? r.notes : null,
        })),
        adSpendLines: input.adLines.map((a) => ({
          platform: a.platform,
          startDate: a.startDate,
          endDate: a.endDate,
          budget: a.budget,
          objective: a.objective ?? null,
        })),
        autoCreateEntries: input.autoCreateEntries,
      };
      const result = await createCampaign.mutateAsync(payload);
      onCreated(result.campaign.id);
    } catch (err) {
      logger.error("create campaign failed", { err: String(err) });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-3xl">
      <Section title="Basics" defaultOpen>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name" error={errors.name?.message}>
            <input
              {...register("name")}
              className="form-input"
            />
          </Field>
          <Field label="Type">
            <select
              {...register("campaignType")}
              className="form-select"
            >
              {CAMPAIGN_TYPE_VALUES.map((t) => (
                <option key={t} value={t}>
                  {CAMPAIGN_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date" error={errors.startDate?.message}>
            <input
              type="date"
              {...register("startDate")}
              className="form-input"
            />
          </Field>
          <Field label="End date" error={errors.endDate?.message}>
            <input
              type="date"
              {...register("endDate")}
              className="form-input"
            />
          </Field>
          <Field label="Total budget (SAR)" error={errors.totalBudget?.message}>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register("totalBudget")}
              className="form-input"
            />
          </Field>
        </div>
      </Section>

      <Section title="Offer details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Trigger">
            <input
              {...register("offerTrigger")}
              placeholder="Buy 1 get 1 free"
              className="form-input"
            />
          </Field>
          <Field label="Reward">
            <input
              {...register("offerReward")}
              placeholder="Free chocolate box"
              className="form-input"
            />
          </Field>
          <Field label="Promo code">
            <input
              {...register("promoCode")}
              className="form-input"
            />
          </Field>
        </div>
      </Section>

      <Section title={`Branch rollouts (${rolloutsArr.fields.length})`}>
        <div className="space-y-2">
          {rolloutsArr.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_auto] gap-2 items-start p-3 border border-line rounded-md bg-cream-2/30"
            >
              <select
                {...register(`rollouts.${index}.branchId`, {
                  onChange: (e) => {
                    const branch = branches.data?.find((b) => b.id === e.target.value);
                    setValue(`rollouts.${index}.branchName`, branch?.name ?? "");
                  },
                })}
                className="form-select"
              >
                <option value="">— select branch —</option>
                {branches.data?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.city}
                  </option>
                ))}
              </select>
              <input
                type="date"
                {...register(`rollouts.${index}.rolloutDate`)}
                className="form-input"
              />
              <select
                {...register(`rollouts.${index}.leadAssignee`)}
                className="form-select"
              >
                {ASSIGNEE_VALUES.map((a) => (
                  <option key={a} value={a}>
                    {ASSIGNEE_LABELS[a]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => rolloutsArr.remove(index)}
                aria-label="Remove rollout"
                className="p-2 text-rose-deep hover:brightness-90"
              >
                <Trash2 size={16} />
              </button>
              {(errors.rollouts?.[index]?.branchId || errors.rollouts?.[index]?.rolloutDate) && (
                <p className="md:col-span-4 text-rose-deep text-[12px]">
                  {errors.rollouts[index]?.branchId?.message ??
                    errors.rollouts[index]?.rolloutDate?.message}
                </p>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              rolloutsArr.append({
                branchId: "",
                branchName: "",
                rolloutDate: watchedStart,
                leadAssignee: "junaid",
                notes: "",
              })
            }
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-line-2 rounded-md text-[13px] text-ink-2 hover:text-ink hover:border-ink-2/40"
          >
            <Plus size={14} />
            Add rollout
          </button>
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm">
          <input type="checkbox" {...register("autoCreateEntries")} />
          Auto-create shop_activity calendar entry + 3-task chain per rollout
        </label>
      </Section>

      <Section title={`Ad spend lines (${adLinesArr.fields.length})`}>
        <div className="space-y-2">
          {adLinesArr.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 md:grid-cols-[120px_140px_140px_120px_120px_auto] gap-2 items-start p-3 border border-line rounded-md bg-cream-2/30"
            >
              <select
                {...register(`adLines.${index}.platform`)}
                className="form-select"
              >
                {AD_PLATFORM_VALUES.map((p) => (
                  <option key={p} value={p}>
                    {AD_PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
              <input
                type="date"
                {...register(`adLines.${index}.startDate`)}
                className="form-input"
              />
              <input
                type="date"
                {...register(`adLines.${index}.endDate`)}
                className="form-input"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Budget"
                {...register(`adLines.${index}.budget`)}
                className="form-input"
              />
              <select
                {...register(`adLines.${index}.objective`)}
                className="form-select"
              >
                <option value="">— objective —</option>
                {AD_OBJECTIVE_VALUES.map((o) => (
                  <option key={o} value={o}>
                    {AD_OBJECTIVE_LABELS[o]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => adLinesArr.remove(index)}
                aria-label="Remove ad line"
                className="p-2 text-rose-deep hover:brightness-90"
              >
                <Trash2 size={16} />
              </button>
              {(errors.adLines?.[index]?.startDate || errors.adLines?.[index]?.endDate) && (
                <p className="md:col-span-6 text-rose-deep text-[12px]">
                  {errors.adLines[index]?.startDate?.message ??
                    errors.adLines[index]?.endDate?.message}
                </p>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              adLinesArr.append({
                platform: AD_PLATFORMS.TIKTOK,
                startDate: watchedStart,
                endDate: watch("endDate"),
                budget: 0,
                objective: undefined,
              })
            }
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-line-2 rounded-md text-[13px] text-ink-2 hover:text-ink hover:border-ink-2/40"
          >
            <Plus size={14} />
            Add ad spend line
          </button>
        </div>
      </Section>

      <Section title="Notes">
        <textarea
          rows={3}
          {...register("notes")}
          className="form-textarea"
        />
      </Section>

      {createCampaign.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-3 py-2 text-[12.5px]">
          {createCampaign.error instanceof Error
            ? createCampaign.error.message
            : "Failed to create campaign."}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-line">
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || createCampaign.isPending}
          className="btn btn-primary disabled:opacity-50"
        >
          {createCampaign.isPending ? "Creating…" : "Create campaign"}
        </button>
      </div>
    </form>
  );
}

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

function Section({ title, defaultOpen = false, children }: SectionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-cream-2/40 text-left hover:bg-cream-2/60 transition"
      >
        <span className="font-serif text-[15px] tracking-tight text-ink">{title}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && <div className="p-5 border-t border-line">{children}</div>}
    </section>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  children: ReactNode;
}

function Field({ label, error, children }: FieldProps): JSX.Element {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {error && <p className="text-rose-deep text-[12px] mt-1.5">{error}</p>}
    </div>
  );
}


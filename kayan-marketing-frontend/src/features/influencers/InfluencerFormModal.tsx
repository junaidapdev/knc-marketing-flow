import { useEffect, useMemo, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { z } from "zod";
import { X, Check, Copy, Loader2, AlertCircle } from "lucide-react";
import { useCurrentBrand } from "../../hooks/use-current-brand";
import {
  useCreateInfluencer,
  useUpdateInfluencer,
} from "./hooks/use-influencers";
import {
  INFLUENCER_NICHE_TAGS,
  INFLUENCER_NICHE_TAG_LABELS,
  type InfluencerNicheTag,
} from "../../constants/influencer-niche-tags";
import {
  INFLUENCER_LANGUAGES,
  INFLUENCER_LANGUAGE_LABELS,
  type InfluencerLanguage,
} from "../../constants/influencer-languages";
import {
  INFLUENCER_STATUS,
  INFLUENCER_STATUS_LABELS,
} from "../../constants/influencer-status";
import type {
  CreateInfluencerInput,
  Influencer,
  UpdateInfluencerInput,
} from "../../types/influencer";
import { logger } from "../../utils/logger";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editing: Influencer | null;
}

const statusValues = [
  INFLUENCER_STATUS.ACTIVE,
  INFLUENCER_STATUS.PAUSED,
  INFLUENCER_STATUS.BLACKLISTED,
] as const;

const languageValues = [
  INFLUENCER_LANGUAGES.ARABIC,
  INFLUENCER_LANGUAGES.ENGLISH,
] as const;

const optionalUrl = z.union([
  z.literal(""),
  z.string().trim().url("Use a valid URL."),
]);
const optionalNumber = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || Number(value) >= 0,
    "Use a non-negative number.",
  );

const formSchema = z
  .object({
    displayName: z.string().trim().min(1, "Display name is required.").max(200),
    fullName: z.string().trim().max(500),
    whatsapp: z
      .string()
      .trim()
      .min(5, "WhatsApp is required.")
      .max(40)
      .regex(/^\+?[0-9][0-9\s().-]*$/, "Use a valid WhatsApp phone number."),
    city: z.string().trim().max(500),
    tiktokHandle: z.string().trim().max(120),
    tiktokUrl: optionalUrl,
    tiktokFollowers: optionalNumber,
    instagramHandle: z.string().trim().max(120),
    instagramUrl: optionalUrl,
    instagramFollowers: optionalNumber,
    snapchatHandle: z.string().trim().max(120),
    snapchatUrl: optionalUrl,
    snapchatFollowers: optionalNumber,
    standardRate: optionalNumber,
    acceptsBarter: z.boolean(),
    nicheTags: z.array(z.enum(INFLUENCER_NICHE_TAGS)),
    languages: z.array(z.enum(languageValues)),
    notes: z.string().trim().max(5000),
    status: z.enum(statusValues),
  })
  .superRefine((data, ctx) => {
    if (
      !data.tiktokHandle.trim() &&
      !data.instagramHandle.trim() &&
      !data.snapchatHandle.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tiktokHandle"],
        message: "Add at least one platform handle.",
      });
    }
  });

type InfluencerFormValues = z.infer<typeof formSchema>;

const EMPTY_VALUES: InfluencerFormValues = {
  displayName: "",
  fullName: "",
  whatsapp: "",
  city: "",
  tiktokHandle: "",
  tiktokUrl: "",
  tiktokFollowers: "",
  instagramHandle: "",
  instagramUrl: "",
  instagramFollowers: "",
  snapchatHandle: "",
  snapchatUrl: "",
  snapchatFollowers: "",
  standardRate: "",
  acceptsBarter: false,
  nicheTags: [],
  languages: [INFLUENCER_LANGUAGES.ARABIC],
  notes: "",
  status: INFLUENCER_STATUS.ACTIVE,
};

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function valuesFromInfluencer(
  influencer: Influencer | null,
): InfluencerFormValues {
  if (!influencer) return EMPTY_VALUES;
  return {
    displayName: influencer.displayName,
    fullName: influencer.fullName ?? "",
    whatsapp: influencer.whatsapp,
    city: influencer.city ?? "",
    tiktokHandle: influencer.tiktokHandle ?? "",
    tiktokUrl: influencer.tiktokUrl ?? "",
    tiktokFollowers: influencer.tiktokFollowers?.toString() ?? "",
    instagramHandle: influencer.instagramHandle ?? "",
    instagramUrl: influencer.instagramUrl ?? "",
    instagramFollowers: influencer.instagramFollowers?.toString() ?? "",
    snapchatHandle: influencer.snapchatHandle ?? "",
    snapchatUrl: influencer.snapchatUrl ?? "",
    snapchatFollowers: influencer.snapchatFollowers?.toString() ?? "",
    standardRate: influencer.standardRate?.toString() ?? "",
    acceptsBarter: influencer.acceptsBarter,
    nicheTags: influencer.nicheTags,
    languages: influencer.languages,
    notes: influencer.notes ?? "",
    status: influencer.status,
  };
}

function toPayload(
  brandId: string,
  values: InfluencerFormValues,
): CreateInfluencerInput {
  return {
    brandId,
    displayName: values.displayName.trim(),
    fullName: clean(values.fullName),
    whatsapp: values.whatsapp.trim(),
    city: clean(values.city),
    tiktokHandle: clean(values.tiktokHandle),
    tiktokUrl: clean(values.tiktokUrl),
    tiktokFollowers: numberOrNull(values.tiktokFollowers),
    instagramHandle: clean(values.instagramHandle),
    instagramUrl: clean(values.instagramUrl),
    instagramFollowers: numberOrNull(values.instagramFollowers),
    snapchatHandle: clean(values.snapchatHandle),
    snapchatUrl: clean(values.snapchatUrl),
    snapchatFollowers: numberOrNull(values.snapchatFollowers),
    standardRate: numberOrNull(values.standardRate),
    acceptsBarter: values.acceptsBarter,
    nicheTags: values.nicheTags,
    languages: values.languages,
    notes: clean(values.notes),
    status: values.status,
  };
}

export function InfluencerFormModal({
  isOpen,
  onClose,
  editing,
}: Props): JSX.Element | null {
  const { brandId } = useCurrentBrand();
  const create = useCreateInfluencer();
  const update = useUpdateInfluencer();
  const [created, setCreated] = useState<Influencer | null>(null);
  const [copied, setCopied] = useState<"portal" | "message" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InfluencerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(valuesFromInfluencer(editing));
    setCreated(null);
    setCopied(null);
    setError(null);
  }, [isOpen, editing, reset]);

  const nicheTags = watch("nicheTags");
  const languages = watch("languages");
  const isPending = create.isPending || update.isPending;
  const portalUrl = useMemo(
    () =>
      created ? `${window.location.origin}/creator/${created.portalToken}` : "",
    [created],
  );
  const welcomeMessage = created
    ? `Hi ${created.displayName}, welcome to Kayan's creator network. Your portal link: ${portalUrl} — bookmark this on your phone for future submissions. We'll be in touch with your first brief soon.`
    : "";

  if (!isOpen) return null;

  const toggleNiche = (tag: InfluencerNicheTag): void => {
    const next = nicheTags.includes(tag)
      ? nicheTags.filter((t) => t !== tag)
      : [...nicheTags, tag];
    setValue("nicheTags", next, { shouldDirty: true, shouldValidate: true });
  };

  const toggleLanguage = (language: InfluencerLanguage): void => {
    const next = languages.includes(language)
      ? languages.filter((l) => l !== language)
      : [...languages, language];
    setValue("languages", next, { shouldDirty: true, shouldValidate: true });
  };

  const copyText = async (
    kind: "portal" | "message",
    text: string,
  ): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch (err) {
      logger.warn("clipboard write failed", { err: String(err) });
    }
  };

  const onSubmit = async (values: InfluencerFormValues): Promise<void> => {
    setError(null);
    try {
      const payload = toPayload(brandId, values);
      if (editing) {
        const updatePayload: UpdateInfluencerInput = { ...payload };
        await update.mutateAsync({ id: editing.id, input: updatePayload });
        onClose();
      } else {
        const influencer = await create.mutateAsync(payload);
        setCreated(influencer);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      setError(message);
      logger.error("influencer save failed", { err: String(err) });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={isPending ? undefined : onClose}
    >
      <div
        className="w-full max-w-3xl bg-paper rounded-lg shadow-lg text-ink max-h-[95vh] sm:max-h-[90vh] overflow-y-auto canvas-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-line sticky top-0 bg-paper z-10">
          <div>
            <h2 className="font-serif text-[20px] tracking-tight text-ink">
              {editing
                ? "Edit influencer"
                : created
                  ? "Influencer created"
                  : "Add influencer"}
            </h2>
            <p className="text-[12px] text-ink-3 mt-0.5">
              Internal Kayan creator database.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
            className="iconbtn disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {created ? (
          <div className="px-4 sm:px-6 py-5 space-y-4">
            <div className="rounded-md bg-sage/30 text-[#2C5530] px-3 py-2 text-[13px] flex items-center gap-2">
              <Check size={14} />
              Saved {created.displayName}. Copy the portal link or welcome
              message when ready.
            </div>
            <div>
              <label className="field-label">Future portal link</label>
              <div className="form-input flex items-center justify-between gap-2">
                <span className="truncate">{portalUrl}</span>
                <button
                  type="button"
                  onClick={() => copyText("portal", portalUrl)}
                  className="text-[12px] font-semibold text-ink hover:underline flex items-center gap-1"
                >
                  <Copy size={12} />
                  {copied === "portal" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div>
              <label className="field-label">WhatsApp welcome message</label>
              <textarea
                readOnly
                value={welcomeMessage}
                rows={4}
                className="form-textarea"
              />
              <button
                type="button"
                onClick={() => copyText("message", welcomeMessage)}
                className="btn btn-primary mt-2"
              >
                <Copy size={13} />
                {copied === "message"
                  ? "Copied"
                  : "Copy WhatsApp Welcome Message"}
              </button>
            </div>
            <div className="flex justify-end border-t border-line pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="px-4 sm:px-6 py-5 space-y-6"
          >
            <FormSection title="Identity">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Display name" error={errors.displayName?.message}>
                  <input
                    {...register("displayName")}
                    className="form-input"
                    autoFocus
                  />
                </Field>
                <Field label="Full name" error={errors.fullName?.message}>
                  <input {...register("fullName")} className="form-input" />
                </Field>
                <Field label="WhatsApp" error={errors.whatsapp?.message}>
                  <input
                    {...register("whatsapp")}
                    className="form-input"
                    placeholder="+966..."
                  />
                </Field>
                <Field label="City" error={errors.city?.message}>
                  <input {...register("city")} className="form-input" />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Platforms">
              <PlatformFields
                title="TikTok"
                handleField="tiktokHandle"
                urlField="tiktokUrl"
                followersField="tiktokFollowers"
                register={register}
                errors={errors}
              />
              <PlatformFields
                title="Instagram"
                handleField="instagramHandle"
                urlField="instagramUrl"
                followersField="instagramFollowers"
                register={register}
                errors={errors}
              />
              <PlatformFields
                title="Snapchat"
                handleField="snapchatHandle"
                urlField="snapchatUrl"
                followersField="snapchatFollowers"
                register={register}
                errors={errors}
              />
            </FormSection>

            <FormSection title="Commercials">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Standard rate"
                  error={errors.standardRate?.message}
                >
                  <input
                    {...register("standardRate")}
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-input"
                  />
                </Field>
                <label className="flex items-center gap-2.5 mt-6 text-[13px] text-ink-2">
                  <input
                    type="checkbox"
                    {...register("acceptsBarter")}
                    className="accent-obsidian"
                  />
                  Accepts barter
                </label>
              </div>
            </FormSection>

            <FormSection title="Content fit">
              <div>
                <label className="field-label">Niche tags</label>
                <div className="flex flex-wrap gap-2">
                  {INFLUENCER_NICHE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleNiche(tag)}
                      className={`chip ${
                        nicheTags.includes(tag)
                          ? "bg-obsidian text-yellow"
                          : "chip-default"
                      }`}
                    >
                      {INFLUENCER_NICHE_TAG_LABELS[tag]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">Languages</label>
                <div className="flex flex-wrap gap-2">
                  {languageValues.map((language) => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => toggleLanguage(language)}
                      className={`chip ${
                        languages.includes(language)
                          ? "bg-obsidian text-yellow"
                          : "chip-default"
                      }`}
                    >
                      {INFLUENCER_LANGUAGE_LABELS[language]}
                    </button>
                  ))}
                </div>
              </div>
            </FormSection>

            <FormSection title="Notes">
              <textarea
                {...register("notes")}
                rows={4}
                className="form-textarea"
              />
            </FormSection>

            {editing && (
              <FormSection title="Status">
                <select
                  {...register("status")}
                  className="form-select max-w-xs"
                >
                  {statusValues.map((status) => (
                    <option key={status} value={status}>
                      {INFLUENCER_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </FormSection>
            )}

            {(errors.tiktokHandle?.message || error) && (
              <div className="rounded-md bg-rose/30 border border-rose-deep/30 text-[#6E2A35] p-3 text-[12.5px] flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{errors.tiktokHandle?.message ?? error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn btn-primary disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Save influencer
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="space-y-3">
      <h3 className="h-card-sm">{title}</h3>
      {children}
    </section>
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
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {error && (
        <span className="text-[11px] text-rose-deep mt-1 block">{error}</span>
      )}
    </label>
  );
}

type PlatformFieldName =
  | "tiktokHandle"
  | "tiktokUrl"
  | "tiktokFollowers"
  | "instagramHandle"
  | "instagramUrl"
  | "instagramFollowers"
  | "snapchatHandle"
  | "snapchatUrl"
  | "snapchatFollowers";

function PlatformFields({
  title,
  handleField,
  urlField,
  followersField,
  register,
  errors,
}: {
  title: string;
  handleField: PlatformFieldName;
  urlField: PlatformFieldName;
  followersField: PlatformFieldName;
  register: UseFormRegister<InfluencerFormValues>;
  errors: FieldErrors<InfluencerFormValues>;
}): JSX.Element {
  return (
    <div className="rounded-md border border-line p-3">
      <div className="font-semibold text-[13px] text-ink mb-3">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Handle" error={errors[handleField]?.message}>
          <input
            {...register(handleField)}
            className="form-input"
            placeholder="@handle"
          />
        </Field>
        <Field label="URL" error={errors[urlField]?.message}>
          <input {...register(urlField)} className="form-input" />
        </Field>
        <Field label="Followers" error={errors[followersField]?.message}>
          <input
            {...register(followersField)}
            type="number"
            min={0}
            className="form-input"
          />
        </Field>
      </div>
    </div>
  );
}

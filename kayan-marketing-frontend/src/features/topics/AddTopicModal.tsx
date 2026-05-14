import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import {
  CONTENT_FORMATS,
  CONTENT_FORMAT_LABELS,
  CONTENT_FORMATS_WITH_PLATFORMS,
  type ContentFormat,
} from "../../constants/content-formats";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
} from "../../constants/social-platform";
import { PATTERNS, type PatternId } from "../../constants/patterns";
import {
  TOPIC_OCCASIONS,
  TOPIC_OCCASION_LABELS,
  type TopicOccasion,
} from "../../constants/topics";
import { BranchSelector } from "../branches/BranchSelector";
import { useCreateTopic } from "./hooks/use-topics";
import { logger } from "../../utils/logger";

const FORMAT_VALUES = Object.values(CONTENT_FORMATS) as [ContentFormat, ...ContentFormat[]];
const PLATFORM_VALUES = Object.values(SOCIAL_PLATFORMS) as [SocialPlatform, ...SocialPlatform[]];

// Same defaults as AddEntryModal — video goes to all 3 platforms by default
// since the whole refactor is about "shoot once, post everywhere."
const DEFAULT_PLATFORMS: Partial<Record<ContentFormat, SocialPlatform[]>> = {
  [CONTENT_FORMATS.VIDEO]: ["tiktok", "instagram", "snapchat"],
  [CONTENT_FORMATS.STORY]: ["instagram", "snapchat"],
};

function defaultPlatformsFor(format: ContentFormat): SocialPlatform[] {
  return DEFAULT_PLATFORMS[format] ?? [];
}

const formSchema = z
  .object({
    title: z.string().max(200).optional(),
    titleEn: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    descriptionEn: z.string().max(2000).optional(),
    patternId: z.string().regex(/^P\d{1,2}$/).or(z.literal("")).optional(),
    branchId: z.string().optional(),
    theme: z.string().max(200).optional(),
    occasion: z.string().optional(),
    format: z.enum(FORMAT_VALUES),
    defaultPlatforms: z.array(z.enum(PLATFORM_VALUES)),
    priority: z.coerce.number().int().min(0).max(100),
    notes: z.string().max(5000).optional(),
  })
  .superRefine((data, ctx) => {
    const ar = (data.title ?? "").trim();
    const en = (data.titleEn ?? "").trim();
    if (ar.length === 0 && en.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title"],
        message: "Add at least one title (Arabic or English).",
      });
    }
    if (ar.length > 0 && ar.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title"],
        message: "Arabic title must be at least 3 characters.",
      });
    }
    if (en.length > 0 && en.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["titleEn"],
        message: "English title must be at least 3 characters.",
      });
    }
    if (CONTENT_FORMATS_WITH_PLATFORMS.has(data.format) && data.defaultPlatforms.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultPlatforms"],
        message: "Pick at least one platform.",
      });
    }
  });

type FormInput = z.infer<typeof formSchema>;

interface Props {
  brandId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AddTopicModal({ brandId, isOpen, onClose }: Props): JSX.Element | null {
  const createTopic = useCreateTopic();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      titleEn: "",
      description: "",
      descriptionEn: "",
      patternId: "",
      branchId: "",
      theme: "",
      occasion: "regular",
      format: CONTENT_FORMATS.VIDEO,
      defaultPlatforms: defaultPlatformsFor(CONTENT_FORMATS.VIDEO),
      priority: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        title: "",
        description: "",
        patternId: "",
        branchId: "",
        theme: "",
        occasion: "regular",
        format: CONTENT_FORMATS.VIDEO,
        defaultPlatforms: defaultPlatformsFor(CONTENT_FORMATS.VIDEO),
        priority: 0,
        notes: "",
      });
    }
  }, [isOpen, reset]);

  const watchedFormat = watch("format");
  const watchedPlatforms = watch("defaultPlatforms");
  const showPlatforms = CONTENT_FORMATS_WITH_PLATFORMS.has(watchedFormat);

  // Reset platforms to the format's default whenever format changes.
  useEffect(() => {
    setValue("defaultPlatforms", defaultPlatformsFor(watchedFormat), { shouldDirty: true });
  }, [watchedFormat, setValue]);

  const togglePlatform = (platform: SocialPlatform): void => {
    const current = watchedPlatforms ?? [];
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    setValue("defaultPlatforms", next, { shouldDirty: true });
  };

  const onSubmit = async (input: FormInput): Promise<void> => {
    const arTitle = input.title?.trim() ?? "";
    const enTitle = input.titleEn?.trim() ?? "";
    const titleField = arTitle.length > 0 ? arTitle : enTitle;
    const titleEnField = arTitle.length > 0 && enTitle.length > 0 ? enTitle : null;

    const arDesc = input.description?.trim() ?? "";
    const enDesc = input.descriptionEn?.trim() ?? "";
    const descField = arDesc.length > 0 ? arDesc : enDesc.length > 0 ? enDesc : null;
    const descEnField = arDesc.length > 0 && enDesc.length > 0 ? enDesc : null;

    try {
      await createTopic.mutateAsync({
        brandId,
        title: titleField,
        titleEn: titleEnField,
        description: descField,
        descriptionEn: descEnField,
        patternId: input.patternId ? (input.patternId as PatternId) : null,
        branchId: input.branchId || null,
        theme: input.theme?.trim() ? input.theme : null,
        occasion: (input.occasion as TopicOccasion) || null,
        format: input.format,
        defaultPlatforms: CONTENT_FORMATS_WITH_PLATFORMS.has(input.format)
          ? input.defaultPlatforms
          : [],
        priority: input.priority,
        notes: input.notes?.trim() ? input.notes : null,
      });
      onClose();
    } catch (err) {
      logger.error("topic create failed", { err: String(err) });
    }
  };

  if (!isOpen) return null;

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
              Add a topic
            </h2>
            <p className="text-[12px] text-ink-3 mt-0.5">
              Drop an idea into the queue. Use it later to spawn an entry in one click.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-4 sm:px-6 py-5 space-y-4">
          <p className="text-[11.5px] text-ink-3 italic">
            Fill in either Arabic, English, or both. At least one title is required.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Title (Arabic)</label>
              <input
                type="text"
                dir="rtl"
                placeholder="مثلاً: شوكولاتات العيد الفخمة بـ ١٦.٨٠ هللة"
                {...register("title")}
                className="form-input"
              />
              {errors.title && (
                <p className="text-rose-deep text-[12px] mt-1.5">
                  {errors.title.message}
                </p>
              )}
            </div>
            <div>
              <label className="field-label">Title (English)</label>
              <input
                type="text"
                placeholder="e.g., Boxed chocolates Mother's Day showcase"
                {...register("titleEn")}
                className="form-input"
              />
              {errors.titleEn && (
                <p className="text-rose-deep text-[12px] mt-1.5">
                  {errors.titleEn.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Description (Arabic, optional)</label>
              <textarea
                rows={3}
                dir="rtl"
                {...register("description")}
                className="form-textarea"
              />
            </div>
            <div>
              <label className="field-label">Description (English, optional)</label>
              <textarea
                rows={3}
                {...register("descriptionEn")}
                className="form-textarea"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Pattern</label>
              <select {...register("patternId")} className="form-select">
                <option value="">— none —</option>
                {PATTERNS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Format</label>
              <select {...register("format")} className="form-select">
                {FORMAT_VALUES.map((f) => (
                  <option key={f} value={f}>
                    {CONTENT_FORMAT_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showPlatforms && (
            <div>
              <label className="field-label">Platforms (default)</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_VALUES.map((p) => {
                  const checked = watchedPlatforms?.includes(p) ?? false;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={`text-[12.5px] px-3 py-1.5 rounded-full font-medium transition border ${
                        checked
                          ? "bg-obsidian text-yellow border-obsidian"
                          : "bg-cream-2 text-ink-2 border-line hover:bg-cream"
                      }`}
                    >
                      {SOCIAL_PLATFORM_LABELS[p]}
                    </button>
                  );
                })}
              </div>
              {errors.defaultPlatforms && (
                <p className="text-rose-deep text-[12px] mt-1.5">
                  {errors.defaultPlatforms.message}
                </p>
              )}
              <p className="text-[11.5px] text-ink-3 mt-1.5">
                These default to all checked when "Use this" turns the topic into a calendar entry. You can change them at that point.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Branch (optional)</label>
              <Controller
                name="branchId"
                control={control}
                render={({ field }) => (
                  <BranchSelector
                    brandId={brandId}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    includeAllOption
                    allOptionLabel="— any branch —"
                    ariaLabel="Branch"
                  />
                )}
              />
            </div>
            <div>
              <label className="field-label">Theme</label>
              <input
                type="text"
                placeholder="e.g., Japanese cake new flavors"
                maxLength={200}
                {...register("theme")}
                className="form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Occasion</label>
              <select {...register("occasion")} className="form-select">
                {TOPIC_OCCASIONS.map((o) => (
                  <option key={o} value={o}>
                    {TOPIC_OCCASION_LABELS[o]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Priority (0–100)</label>
              <input
                type="number"
                min={0}
                max={100}
                {...register("priority")}
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Notes (optional)</label>
            <textarea rows={2} {...register("notes")} className="form-textarea" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : "Save topic"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

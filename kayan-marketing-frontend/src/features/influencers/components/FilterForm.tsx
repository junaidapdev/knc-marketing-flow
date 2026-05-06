import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Calculator } from "lucide-react";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  type Platform,
  CONTENT_CATEGORIES,
  CONTENT_CATEGORY_LABELS,
  type ContentCategory,
  LANGUAGES,
  LANGUAGE_LABELS,
  type Language,
  GCC_COUNTRIES,
  GCC_COUNTRY_LABELS,
  type GccCountry,
} from "../../../constants/influencer";
import type { CreatorSearchFilters } from "../../../types/influencer";

// Tuple casts so z.enum is happy (z.enum requires [string, ...string[]]).
const PLATFORM_VALUES = [...PLATFORMS] as [Platform, ...Platform[]];
const CATEGORY_VALUES = [...CONTENT_CATEGORIES] as [ContentCategory, ...ContentCategory[]];
const LANGUAGE_VALUES = [...LANGUAGES] as [Language, ...Language[]];
const COUNTRY_VALUES = [...GCC_COUNTRIES] as [GccCountry, ...GccCountry[]];

const POSTING_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
const POSTING_FREQUENCY_LABELS: Record<(typeof POSTING_FREQUENCIES)[number], string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const GENDER_SKEWS = ["female", "male", "balanced"] as const;
const GENDER_SKEW_LABELS: Record<(typeof GENDER_SKEWS)[number], string> = {
  female: "Female-leaning",
  male: "Male-leaning",
  balanced: "Balanced",
};

const formSchema = z
  .object({
    platforms: z
      .array(z.enum(PLATFORM_VALUES))
      .min(1, "Select at least one platform."),
    countries: z.array(z.enum(COUNTRY_VALUES)),
    city: z.string().max(120).optional(),
    ageMin: z.coerce.number().int().min(13).max(65),
    ageMax: z.coerce.number().int().min(13).max(65),
    genderSkew: z.enum(GENDER_SKEWS),
    audienceCountries: z.array(z.enum(COUNTRY_VALUES)),
    followerMin: z.coerce.number().int().min(0),
    followerMax: z.coerce.number().int().min(0),
    engagementRateMin: z.coerce.number().min(0).max(100),
    engagementRateMax: z.coerce.number().min(0).max(100),
    avgViewsMin: z.coerce.number().int().min(0),
    avgLikesMin: z.coerce.number().int().min(0),
    postingFrequency: z.enum(POSTING_FREQUENCIES),
    categories: z.array(z.enum(CATEGORY_VALUES)),
    language: z.enum(LANGUAGE_VALUES),
  })
  .superRefine((data, ctx) => {
    if (data.ageMin > data.ageMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ageMax"],
        message: "Max age must be ≥ min age.",
      });
    }
    if (data.followerMin > data.followerMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["followerMax"],
        message: "Max followers must be ≥ min.",
      });
    }
    if (data.engagementRateMin > data.engagementRateMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["engagementRateMax"],
        message: "Max engagement must be ≥ min.",
      });
    }
  });

type FormInput = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormInput = {
  platforms: ["tiktok", "instagram", "youtube"],
  countries: ["sa"],
  city: "",
  ageMin: 18,
  ageMax: 45,
  genderSkew: "balanced",
  audienceCountries: [],
  followerMin: 10_000,
  followerMax: 1_000_000,
  engagementRateMin: 1,
  engagementRateMax: 20,
  avgViewsMin: 0,
  avgLikesMin: 0,
  postingFrequency: "weekly",
  categories: ["dessert", "food"],
  language: "both",
};

interface Props {
  isSubmitting: boolean;
  isEstimating: boolean;
  onSubmit: (filters: CreatorSearchFilters) => void;
  onEstimate: (filters: CreatorSearchFilters) => void;
}

type SubmitIntent = "search" | "estimate";

export function FilterForm({
  isSubmitting,
  isEstimating,
  onSubmit,
  onEstimate,
}: Props): JSX.Element {
  // Both buttons live inside the same form so RHF validation runs once.
  // We track which one was clicked via local state set on click, then
  // dispatch in the form-level submit handler.
  const [intent, setIntent] = useState<SubmitIntent>("search");

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const submit = (input: FormInput): void => {
    // Map the form's required-with-defaults shape into CreatorSearchFilters.
    // Empty arrays / blank strings collapse to undefined so the Edge
    // Functions see a clean payload.
    const filters: CreatorSearchFilters = {
      platforms: input.platforms,
      countries: input.countries,
      city: input.city?.trim() ? input.city.trim() : undefined,
      ageMin: input.ageMin,
      ageMax: input.ageMax,
      genderSkew: input.genderSkew,
      audienceCountries:
        input.audienceCountries.length > 0 ? input.audienceCountries : undefined,
      followerMin: input.followerMin,
      followerMax: input.followerMax,
      engagementRateMin: input.engagementRateMin,
      engagementRateMax: input.engagementRateMax,
      avgViewsMin: input.avgViewsMin,
      avgLikesMin: input.avgLikesMin,
      postingFrequency: input.postingFrequency,
      categories: input.categories,
      language: input.language,
    };
    if (intent === "estimate") onEstimate(filters);
    else onSubmit(filters);
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      {/* ─────── Platforms ─────── */}
      <FilterSection title="Platforms" hint="At least one required.">
        <Controller
          name="platforms"
          control={control}
          render={({ field }) => (
            <ChipMultiSelect
              values={[...PLATFORMS]}
              labels={PLATFORM_LABELS}
              selected={field.value}
              onToggle={(v) =>
                field.onChange(
                  field.value.includes(v)
                    ? field.value.filter((x) => x !== v)
                    : [...field.value, v],
                )
              }
            />
          )}
        />
        {errors.platforms && (
          <p className="text-rose-deep text-[12px] mt-1.5">{errors.platforms.message}</p>
        )}
      </FilterSection>

      {/* ─────── Location ─────── */}
      <FilterSection title="Location" hint="Where the creator is based.">
        <Controller
          name="countries"
          control={control}
          render={({ field }) => (
            <ChipMultiSelect
              values={[...GCC_COUNTRIES]}
              labels={GCC_COUNTRY_LABELS}
              selected={field.value}
              onToggle={(v) =>
                field.onChange(
                  field.value.includes(v)
                    ? field.value.filter((x) => x !== v)
                    : [...field.value, v],
                )
              }
            />
          )}
        />
        <div className="mt-3">
          <label className="field-label">City (optional)</label>
          <input
            type="text"
            placeholder="e.g., Riyadh, Jeddah"
            {...register("city")}
            className="form-input"
          />
        </div>
      </FilterSection>

      {/* ─────── Audience demographics ─────── */}
      <FilterSection
        title="Audience demographics"
        hint="Estimated by third-party scrapers — not platform analytics."
      >
        <div>
          <label className="field-label">Age range</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="number"
                min={13}
                max={65}
                aria-label="Minimum age"
                {...register("ageMin")}
                className="form-input"
              />
              <p className="text-[11px] text-ink-3 mt-1">Min (13–65)</p>
            </div>
            <div>
              <input
                type="number"
                min={13}
                max={65}
                aria-label="Maximum age"
                {...register("ageMax")}
                className="form-input"
              />
              <p className="text-[11px] text-ink-3 mt-1">Max (13–65)</p>
              {errors.ageMax && (
                <p className="text-rose-deep text-[12px] mt-1.5">{errors.ageMax.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <label className="field-label">Gender skew</label>
          <select {...register("genderSkew")} className="form-select">
            {GENDER_SKEWS.map((g) => (
              <option key={g} value={g}>
                {GENDER_SKEW_LABELS[g]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <label className="field-label">Audience country breakdown</label>
          <Controller
            name="audienceCountries"
            control={control}
            render={({ field }) => (
              <ChipMultiSelect
                values={[...GCC_COUNTRIES]}
                labels={GCC_COUNTRY_LABELS}
                selected={field.value}
                onToggle={(v) =>
                  field.onChange(
                    field.value.includes(v)
                      ? field.value.filter((x) => x !== v)
                      : [...field.value, v],
                  )
                }
              />
            )}
          />
          <p className="text-[11px] text-ink-3 mt-1">
            Leave empty for "any". Selected countries must each be in the audience mix.
          </p>
        </div>
      </FilterSection>

      {/* ─────── Engagement metrics ─────── */}
      <FilterSection title="Engagement metrics">
        <div>
          <label className="field-label">Followers</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="number"
                min={0}
                aria-label="Minimum followers"
                {...register("followerMin")}
                className="form-input"
              />
              <p className="text-[11px] text-ink-3 mt-1">Min</p>
            </div>
            <div>
              <input
                type="number"
                min={0}
                aria-label="Maximum followers"
                {...register("followerMax")}
                className="form-input"
              />
              <p className="text-[11px] text-ink-3 mt-1">Max</p>
              {errors.followerMax && (
                <p className="text-rose-deep text-[12px] mt-1.5">
                  {errors.followerMax.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <label className="field-label">Engagement rate (%)</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="number"
                step="0.1"
                min={0}
                max={100}
                aria-label="Minimum engagement rate"
                {...register("engagementRateMin")}
                className="form-input"
              />
              <p className="text-[11px] text-ink-3 mt-1">Min %</p>
            </div>
            <div>
              <input
                type="number"
                step="0.1"
                min={0}
                max={100}
                aria-label="Maximum engagement rate"
                {...register("engagementRateMax")}
                className="form-input"
              />
              <p className="text-[11px] text-ink-3 mt-1">Max %</p>
              {errors.engagementRateMax && (
                <p className="text-rose-deep text-[12px] mt-1.5">
                  {errors.engagementRateMax.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">Avg views (min)</label>
            <input
              type="number"
              min={0}
              {...register("avgViewsMin")}
              className="form-input"
            />
          </div>
          <div>
            <label className="field-label">Avg likes (min)</label>
            <input
              type="number"
              min={0}
              {...register("avgLikesMin")}
              className="form-input"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="field-label">Posting frequency</label>
          <select {...register("postingFrequency")} className="form-select">
            {POSTING_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {POSTING_FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
      </FilterSection>

      {/* ─────── Content categories ─────── */}
      <FilterSection title="Content categories">
        <Controller
          name="categories"
          control={control}
          render={({ field }) => (
            <ChipMultiSelect
              values={[...CONTENT_CATEGORIES]}
              labels={CONTENT_CATEGORY_LABELS}
              selected={field.value}
              onToggle={(v) =>
                field.onChange(
                  field.value.includes(v)
                    ? field.value.filter((x) => x !== v)
                    : [...field.value, v],
                )
              }
            />
          )}
        />
      </FilterSection>

      {/* ─────── Language ─────── */}
      <FilterSection title="Language">
        <select {...register("language")} className="form-select">
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_LABELS[l]}
            </option>
          ))}
        </select>
      </FilterSection>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-2 pt-3 border-t border-line">
        <button
          type="submit"
          onClick={() => setIntent("estimate")}
          disabled={isEstimating || isSubmitting}
          className="btn btn-ghost disabled:opacity-50"
        >
          <Calculator size={14} />
          {isEstimating ? "Estimating…" : "Estimate cost"}
        </button>
        <button
          type="submit"
          onClick={() => setIntent("search")}
          disabled={isSubmitting || isEstimating}
          className="btn btn-primary disabled:opacity-50"
        >
          <Search size={14} />
          {isSubmitting ? "Searching…" : "Search creators"}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tiny presentational helpers, kept local to FilterForm so they don't leak
// into the public components surface. If a similar chip multi-select shows
// up in another feature, promote them later.

function FilterSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="h-card-sm">{title}</h3>
        {hint && <p className="text-[11.5px] text-ink-3 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

interface ChipMultiSelectProps<T extends string> {
  values: ReadonlyArray<T>;
  labels: Record<T, string>;
  selected: ReadonlyArray<T>;
  onToggle: (v: T) => void;
}

function ChipMultiSelect<T extends string>({
  values,
  labels,
  selected,
  onToggle,
}: ChipMultiSelectProps<T>): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => {
        const isOn = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            aria-pressed={isOn}
            className={`chip ${
              isOn ? "bg-obsidian text-yellow" : "chip-default hover:brightness-95"
            }`}
          >
            {labels[v]}
          </button>
        );
      })}
    </div>
  );
}

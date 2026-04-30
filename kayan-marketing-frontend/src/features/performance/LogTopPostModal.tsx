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
import { useCreateTopPost } from "./hooks/use-top-posts";
import { logger } from "../../utils/logger";

const PLATFORM_VALUES = Object.values(SOCIAL_PLATFORMS) as [SocialPlatform, ...SocialPlatform[]];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const formSchema = z.object({
  platform: z.enum(PLATFORM_VALUES),
  postDate: z.string().regex(DATE_REGEX, "Date is required."),
  captionSnippet: z.string().max(500).optional(),
  plays: z.coerce.number().int().nonnegative().optional(),
  likes: z.coerce.number().int().nonnegative().optional(),
  comments: z.coerce.number().int().nonnegative().optional(),
  shares: z.coerce.number().int().nonnegative().optional(),
  engagementRate: z.coerce.number().min(0).max(100).optional(),
  postUrl: z.string().url("Must be a valid URL.").or(z.literal("")).optional(),
  thumbnailUrl: z.string().url().or(z.literal("")).optional(),
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

export function LogTopPostModal({ brandId, isOpen, onClose }: Props): JSX.Element | null {
  const createPost = useCreateTopPost();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platform: SOCIAL_PLATFORMS.TIKTOK,
      postDate: todayIso(),
      captionSnippet: "",
      postUrl: "",
      thumbnailUrl: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        platform: SOCIAL_PLATFORMS.TIKTOK,
        postDate: todayIso(),
        captionSnippet: "",
        postUrl: "",
        thumbnailUrl: "",
      });
    }
  }, [isOpen, reset]);

  const onSubmit = async (input: FormInput): Promise<void> => {
    try {
      await createPost.mutateAsync({
        brandId,
        platform: input.platform,
        postDate: input.postDate,
        captionSnippet: input.captionSnippet?.trim() ? input.captionSnippet : null,
        plays: input.plays ?? null,
        likes: input.likes ?? null,
        comments: input.comments ?? null,
        shares: input.shares ?? null,
        engagementRate: input.engagementRate ?? null,
        postUrl: input.postUrl?.trim() ? input.postUrl : null,
        thumbnailUrl: input.thumbnailUrl?.trim() ? input.thumbnailUrl : null,
      });
      onClose();
    } catch (err) {
      logger.error("create top post failed", { err: String(err) });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-paper rounded-lg shadow-lg text-ink max-h-[95vh] sm:max-h-[90vh] overflow-y-auto canvas-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-serif text-[18px] tracking-tight text-ink">Log top post</h2>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <Field label="Post date" error={errors.postDate?.message}>
              <input
                type="date"
                {...register("postDate")}
                className="form-input"
              />
            </Field>
          </div>

          <Field label="Caption snippet">
            <textarea
              rows={2}
              {...register("captionSnippet")}
              className="form-input"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Plays">
              <input
                type="number"
                min="0"
                {...register("plays")}
                className="form-input"
              />
            </Field>
            <Field label="Likes">
              <input
                type="number"
                min="0"
                {...register("likes")}
                className="form-input"
              />
            </Field>
            <Field label="Comments">
              <input
                type="number"
                min="0"
                {...register("comments")}
                className="form-input"
              />
            </Field>
            <Field label="Shares">
              <input
                type="number"
                min="0"
                {...register("shares")}
                className="form-input"
              />
            </Field>
            <Field label="Engagement rate (%)">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register("engagementRate")}
                className="form-input"
              />
            </Field>
          </div>

          <Field label="Post URL" error={errors.postUrl?.message}>
            <input
              {...register("postUrl")}
              placeholder="https://…"
              className="form-input"
            />
          </Field>

          {createPost.isError && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-3 py-2 text-[12.5px]">
              {createPost.error instanceof Error ? createPost.error.message : "Failed to save."}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createPost.isPending}
              className="btn btn-primary disabled:opacity-50"
            >
              {createPost.isPending ? "Saving…" : "Save post"}
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

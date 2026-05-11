import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requirePortalToken } from "../_shared/portal-auth.ts";
import type {
  PortalInfluencerRecord,
  PortalInfluencerView,
  PortalPlatformView,
} from "../_shared/portal-types.ts";

const METHOD_GET = "GET";
const METHOD_POST = "POST";
const METHOD_OPTIONS = "OPTIONS";
const ROUTE_PORTAL = "portal";
const ROUTE_COLLABORATIONS = "collaborations";
const ROUTE_SUBMISSIONS = "submissions";
const ERROR_NOT_FOUND = "NOT_FOUND";
const ERROR_INTERNAL = "INTERNAL_ERROR";
const ERROR_VALIDATION = "VALIDATION_FAILED";
const MESSAGE_METHOD_NOT_SUPPORTED = "Method not supported.";
const MESSAGE_INVALID_JSON = "Invalid JSON.";
const MESSAGE_VALIDATION = "Validation failed.";
const MESSAGE_SERVER_CONFIG = "Server configuration error.";
const MESSAGE_EMPTY_SUBMISSION = "Submission response was empty.";
const STATUS_NOT_FOUND = 404;
const STATUS_INTERNAL = 500;
const STATUS_BAD_REQUEST = 400;
const STATUS_UNPROCESSABLE = 422;
const PLATFORM_TIKTOK = "tiktok";
const PLATFORM_INSTAGRAM = "instagram";
const PLATFORM_SNAPCHAT = "snapchat";
const LABEL_TIKTOK = "TikTok";
const LABEL_INSTAGRAM = "Instagram";
const LABEL_SNAPCHAT = "Snapchat";
const ACTIVE_COLLAB_STATUSES = ["planned", "in_progress", "live"] as const;

const urlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Use an http or https URL.")
  .nullable()
  .optional();

const submissionSchema = z
  .object({
    entryId: z.string().uuid(),
    tiktokPostUrl: urlSchema,
    instagramPostUrl: urlSchema,
    snapchatPostUrl: urlSchema,
    taggedKayan: z.boolean().nullable().optional(),
    usedPromoCode: z.boolean().nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.tiktokPostUrl && !data.instagramPostUrl && !data.snapchatPostUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tiktokPostUrl"],
        message: "Add at least one post URL.",
      });
    }
  });

interface SubmissionRow {
  entry_id: string;
  submitted_at: string;
  tiktok_post_url: string | null;
  instagram_post_url: string | null;
  snapchat_post_url: string | null;
  tagged_kayan: boolean | null;
  used_promo_code: boolean | null;
  notes: string | null;
  verification_status: "pending" | "verified" | "disputed";
}

interface CollaborationRow {
  id: string;
  title: string;
  description: string | null;
  target_date: string;
  status: "planned" | "in_progress" | "live";
  notes: string | null;
}

interface PortalSubmissionView {
  entryId: string;
  submittedAt: string;
  tiktokPostUrl: string | null;
  instagramPostUrl: string | null;
  snapchatPostUrl: string | null;
  taggedKayan: boolean | null;
  usedPromoCode: boolean | null;
  notes: string | null;
  verificationStatus: "pending" | "verified" | "disputed";
}

interface PortalCollaborationView {
  entryId: string;
  title: string;
  targetDate: string;
  status: "planned" | "in_progress" | "live";
  description: string | null;
  existingSubmission: PortalSubmissionView | null;
}

function addPlatform(
  platforms: PortalPlatformView[],
  platform: PortalPlatformView,
): PortalPlatformView[] {
  if (!platform.handle.trim()) return platforms;
  return [...platforms, platform];
}

function toPortalView(influencer: PortalInfluencerRecord): PortalInfluencerView {
  const platformOptions: PortalPlatformView[] = [
    {
      key: PLATFORM_TIKTOK,
      label: LABEL_TIKTOK,
      handle: influencer.tiktok_handle ?? "",
      url: influencer.tiktok_url,
      followers: influencer.tiktok_followers,
    },
    {
      key: PLATFORM_INSTAGRAM,
      label: LABEL_INSTAGRAM,
      handle: influencer.instagram_handle ?? "",
      url: influencer.instagram_url,
      followers: influencer.instagram_followers,
    },
    {
      key: PLATFORM_SNAPCHAT,
      label: LABEL_SNAPCHAT,
      handle: influencer.snapchat_handle ?? "",
      url: influencer.snapchat_url,
      followers: influencer.snapchat_followers,
    },
  ];
  const platforms = platformOptions.reduce(addPlatform, [] as PortalPlatformView[]);

  return {
    displayName: influencer.display_name,
    city: influencer.city,
    platforms,
    nicheTags: influencer.niche_tags,
    languages: influencer.languages,
  };
}

function toSubmissionView(row: SubmissionRow): PortalSubmissionView {
  return {
    entryId: row.entry_id,
    submittedAt: row.submitted_at,
    tiktokPostUrl: row.tiktok_post_url,
    instagramPostUrl: row.instagram_post_url,
    snapchatPostUrl: row.snapchat_post_url,
    taggedKayan: row.tagged_kayan,
    usedPromoCode: row.used_promo_code,
    notes: row.notes,
    verificationStatus: row.verification_status,
  };
}

function routeAfterToken(req: Request): string | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const portalIndex = parts.indexOf(ROUTE_PORTAL);
  if (portalIndex < 0) return null;
  return parts[portalIndex + 2] ?? null;
}

function tokenFromPath(req: Request): string {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const portalIndex = parts.indexOf(ROUTE_PORTAL);
  const token = portalIndex >= 0 ? parts[portalIndex + 1] : "";
  return decodeURIComponent(token);
}

function getServiceClient(): ReturnType<typeof createClient> | { error: Response } {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return { error: jsonError(ERROR_INTERNAL, MESSAGE_SERVER_CONFIG, STATUS_INTERNAL) };
  }
  return createClient(supabaseUrl, serviceKey);
}

function validatePlatformOwnership(
  influencer: PortalInfluencerRecord,
  input: z.infer<typeof submissionSchema>,
): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};
  if (input.tiktokPostUrl && !influencer.tiktok_handle) {
    errors.tiktokPostUrl = ["TikTok is not enabled on this creator profile."];
  }
  if (input.instagramPostUrl && !influencer.instagram_handle) {
    errors.instagramPostUrl = ["Instagram is not enabled on this creator profile."];
  }
  if (input.snapchatPostUrl && !influencer.snapchat_handle) {
    errors.snapchatPostUrl = ["Snapchat is not enabled on this creator profile."];
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

async function listCollaborations(
  db: ReturnType<typeof createClient>,
  influencerId: string,
): Promise<Response> {
  const { data: entries, error: entriesError } = await db
    .from("calendar_entries")
    .select("id, title, description, target_date, status, notes")
    .eq("type", "influencer_collab")
    .eq("influencer_id", influencerId)
    .in("status", [...ACTIVE_COLLAB_STATUSES])
    .order("target_date", { ascending: false });

  if (entriesError) return jsonError(ERROR_INTERNAL, entriesError.message, STATUS_INTERNAL);

  const rows = (entries ?? []) as unknown as CollaborationRow[];
  const entryIds = rows.map((row) => row.id);
  let submissionsByEntry = new Map<string, PortalSubmissionView>();

  if (entryIds.length > 0) {
    const { data: submissions, error: submissionsError } = await db
      .from("influencer_submissions")
      .select(
        [
          "entry_id",
          "submitted_at",
          "tiktok_post_url",
          "instagram_post_url",
          "snapchat_post_url",
          "tagged_kayan",
          "used_promo_code",
          "notes",
          "verification_status",
        ].join(","),
      )
      .eq("influencer_id", influencerId)
      .in("entry_id", entryIds)
      .order("submitted_at", { ascending: false });

    if (submissionsError) {
      return jsonError(ERROR_INTERNAL, submissionsError.message, STATUS_INTERNAL);
    }

    submissionsByEntry = new Map(
      ((submissions ?? []) as unknown as SubmissionRow[]).map((row) => [
        row.entry_id,
        toSubmissionView(row),
      ]),
    );
  }

  const view: PortalCollaborationView[] = rows.map((row) => ({
    entryId: row.id,
    title: row.title,
    targetDate: row.target_date,
    status: row.status,
    description: row.description ?? row.notes,
    existingSubmission: submissionsByEntry.get(row.id) ?? null,
  }));

  return jsonSuccess(view);
}

function safeSubmissionFromRpc(data: unknown): PortalSubmissionView | null {
  if (data === null || typeof data !== "object") return null;
  const submission = (data as Record<string, unknown>).submission;
  if (submission === null || typeof submission !== "object") return null;
  return toSubmissionView(submission as unknown as SubmissionRow);
}

Deno.serve(async (req) => {
  if (req.method === METHOD_OPTIONS) return new Response(null, { headers: corsHeaders });

  const auth = await requirePortalToken(req);
  if ("error" in auth) return auth.error;

  const db = getServiceClient();
  if ("error" in db) return db.error;

  const route = routeAfterToken(req);

  if (req.method === METHOD_GET && route === null) {
    return jsonSuccess(toPortalView(auth.influencer));
  }

  if (req.method === METHOD_GET && route === ROUTE_COLLABORATIONS) {
    return listCollaborations(db, auth.influencer.id);
  }

  if (req.method === METHOD_POST && route === ROUTE_SUBMISSIONS) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(ERROR_VALIDATION, MESSAGE_INVALID_JSON, STATUS_BAD_REQUEST);
    }

    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(ERROR_VALIDATION, MESSAGE_VALIDATION, STATUS_UNPROCESSABLE, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const platformErrors = validatePlatformOwnership(auth.influencer, parsed.data);
    if (platformErrors) {
      return jsonError(ERROR_VALIDATION, MESSAGE_VALIDATION, STATUS_UNPROCESSABLE, {
        fieldErrors: platformErrors,
      });
    }

    const { data, error } = await db.rpc("create_influencer_submission", {
      p_token: tokenFromPath(req),
      p_entry_id: parsed.data.entryId,
      p_tiktok_post_url: parsed.data.tiktokPostUrl ?? null,
      p_instagram_post_url: parsed.data.instagramPostUrl ?? null,
      p_snapchat_post_url: parsed.data.snapchatPostUrl ?? null,
      p_tagged_kayan: parsed.data.taggedKayan ?? null,
      p_used_promo_code: parsed.data.usedPromoCode ?? null,
      p_notes: parsed.data.notes ?? null,
    });

    if (error) return jsonError(ERROR_VALIDATION, error.message, STATUS_UNPROCESSABLE);

    const submission = safeSubmissionFromRpc(data);
    if (!submission) {
      return jsonError(ERROR_INTERNAL, MESSAGE_EMPTY_SUBMISSION, STATUS_INTERNAL);
    }
    return jsonSuccess(submission, 201);
  }

  return jsonError(ERROR_NOT_FOUND, MESSAGE_METHOD_NOT_SUPPORTED, STATUS_NOT_FOUND);
});

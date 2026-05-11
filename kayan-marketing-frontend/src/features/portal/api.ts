import { env } from "../../config/env";
import { CREATOR_PORTAL_COPY } from "../../constants/portal";
import type {
  PortalCollaboration,
  PortalSubmissionView,
} from "../../types/influencer-submission";
import type { PortalInfluencerView } from "../../types/portal";

interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiError {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  if (!isRecord(value)) return false;
  return typeof value.success === "boolean";
}

function getErrorMessage(value: unknown): string {
  if (!isRecord(value)) return CREATOR_PORTAL_COPY.invalidLink;
  const error = value.error;
  if (!isRecord(error)) return CREATOR_PORTAL_COPY.invalidLink;
  return typeof error.message === "string"
    ? error.message
    : CREATOR_PORTAL_COPY.invalidLink;
}

async function portalRequest<T>(
  token: string,
  suffix = "",
  init: RequestInit = {},
): Promise<T> {
  const url = new URL(`${env.VITE_API_BASE_URL}/functions/v1/portal/${encodeURIComponent(token)}${suffix}`);
  const response = await fetch(url.toString(), init);
  const payload: unknown = await response.json().catch(() => null);

  if (!isApiResponse<T>(payload)) {
    throw new Error(CREATOR_PORTAL_COPY.invalidLink);
  }

  if (!payload.success) {
    throw new Error(getErrorMessage(payload));
  }

  return payload.data;
}

export async function fetchPortalProfile(token: string): Promise<PortalInfluencerView> {
  return portalRequest<PortalInfluencerView>(token);
}

export async function fetchPortalCollaborations(token: string): Promise<PortalCollaboration[]> {
  return portalRequest<PortalCollaboration[]>(token, "/collaborations");
}

export interface PortalSubmissionInput {
  entryId: string;
  tiktokPostUrl?: string | null;
  instagramPostUrl?: string | null;
  snapchatPostUrl?: string | null;
  taggedKayan?: boolean | null;
  usedPromoCode?: boolean | null;
  notes?: string | null;
}

export async function submitPortalPost(
  token: string,
  input: PortalSubmissionInput,
): Promise<PortalSubmissionView> {
  return portalRequest<PortalSubmissionView>(token, "/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

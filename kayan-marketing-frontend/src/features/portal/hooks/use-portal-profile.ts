import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CREATOR_PORTAL_COPY,
  CREATOR_PORTAL_QUERY_KEY,
} from "../../../constants/portal";
import type { PortalInfluencerView } from "../../../types/portal";
import type {
  PortalCollaboration,
  PortalSubmissionView,
} from "../../../types/influencer-submission";
import {
  fetchPortalCollaborations,
  fetchPortalProfile,
  submitPortalPost,
  type PortalSubmissionInput,
} from "../api";

export function usePortalProfile(token: string | null) {
  return useQuery({
    queryKey: [CREATOR_PORTAL_QUERY_KEY, token],
    enabled: token !== null && token.trim().length > 0,
    queryFn: async (): Promise<PortalInfluencerView> => {
      if (!token) throw new Error(CREATOR_PORTAL_COPY.missingToken);
      return fetchPortalProfile(token);
    },
    retry: false,
  });
}

export function usePortalCollaborations(token: string | null) {
  return useQuery({
    queryKey: [CREATOR_PORTAL_QUERY_KEY, "collaborations", token],
    enabled: token !== null && token.trim().length > 0,
    queryFn: async (): Promise<PortalCollaboration[]> => {
      if (!token) throw new Error(CREATOR_PORTAL_COPY.missingToken);
      return fetchPortalCollaborations(token);
    },
    retry: false,
  });
}

export function useSubmitPortalPost(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PortalSubmissionInput): Promise<PortalSubmissionView> => {
      if (!token) throw new Error(CREATOR_PORTAL_COPY.missingToken);
      return submitPortalPost(token, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [CREATOR_PORTAL_QUERY_KEY, "collaborations", token],
      });
    },
  });
}

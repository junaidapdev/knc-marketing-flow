import { useMutation } from "@tanstack/react-query";
import type { CreatorResult, CreatorSearchFilters } from "../../../types/influencer";
import { MOCK_CREATORS } from "../data/mock-creators";

// Chunk 2 stub: returns a hardcoded subset of MOCK_CREATORS after a 600ms
// fake delay so the form's loading state is exercised. Real fan-out to the
// /search-creators Edge Function lands in Chunk 3.
//
// We do a tiny bit of client-side filtering against the requested platforms
// + categories so the demo "feels" responsive to the form. Anything more
// (engagement, follower, language, country) stays unfiltered for now —
// that's the backend's job once it's real.

const MOCK_DELAY_MS = 600;

async function mockSearch(filters: CreatorSearchFilters): Promise<CreatorResult[]> {
  await new Promise((r) => window.setTimeout(r, MOCK_DELAY_MS));
  const platforms = new Set(filters.platforms);
  return MOCK_CREATORS.filter((c) => platforms.has(c.platform));
}

export function useCreatorSearch() {
  return useMutation({
    mutationFn: (filters: CreatorSearchFilters): Promise<CreatorResult[]> =>
      mockSearch(filters),
  });
}

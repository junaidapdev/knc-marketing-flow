import type { SocialPlatform } from "../constants/social-platform";

// One row of the entry_publications sub-table (added in migration 0050).
// Represents a single platform on which an entry was (or will be) published.
// The parent entry's status governs the whole piece — these rows track only
// per-platform URL + posted-at timestamp.
export interface EntryPublication {
  id: string;
  platform: SocialPlatform;
  postUrl: string | null;
  postedAt: string | null;
}

export interface EntryPublicationFull extends EntryPublication {
  createdAt: string;
  updatedAt: string;
}

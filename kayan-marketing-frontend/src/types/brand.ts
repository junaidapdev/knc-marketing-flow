export interface Brand {
  id: string;
  name: string;
  brandCode: string;
  primaryColor: string | null;
  voiceConfig: Record<string, unknown>;
  dnaMarkdown: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  lastApifySyncAt: string | null;
  // Production rhythm defaults — applied to new entries / Settings page.
  defaultShootCapacity: number;
  defaultEditorOffset: number;
  defaultSchedulingBuffer: number;
  createdAt: string;
  updatedAt: string;
}

// Subset of voice_config keys the Settings form exposes as proper fields.
// Extra keys in voice_config are preserved on save (we merge, not replace).
export interface BrandVoiceConfig {
  tone?: string;
  primary_language?: string;
  secondary_language?: string;
  audience?: string;
  key_positioning?: string;
  default_hashtags?: string[];
  do_say?: string[];
  dont_say?: string[];
  [key: string]: unknown;
}

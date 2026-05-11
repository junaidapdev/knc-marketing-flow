import { useState } from "react";
import { MapPin, MessageCircle, Moon, Sun } from "lucide-react";
import { useParams } from "react-router-dom";
import { CREATOR_PORTAL_COPY } from "../constants/portal";
import { useThemeStore } from "../stores/theme-store";
import {
  INFLUENCER_LANGUAGE_LABELS,
  type InfluencerLanguage,
} from "../constants/influencer-languages";
import {
  INFLUENCER_NICHE_TAG_LABELS,
  type InfluencerNicheTag,
} from "../constants/influencer-niche-tags";
import {
  usePortalCollaborations,
  usePortalProfile,
  useSubmitPortalPost,
} from "../features/portal/hooks/use-portal-profile";
import type {
  PortalCollaboration,
  PortalSubmissionView,
} from "../types/influencer-submission";
import type {
  PortalPlatformView,
  PortalReliabilityView,
} from "../types/portal";

// Compact form for follower counts inside the platform tiles — "482K"
// reads cleaner than "482,000" at the size we're using. Falls back to
// localized integers below 1k.
function formatCompactCount(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)}K`;
  }
  return value.toLocaleString();
}

// First grapheme of the display name, uppercased, used inside the
// avatar circle. Falls back to "K" if the name is empty / starts with
// whitespace.
function avatarInitial(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "K";
  return trimmed.charAt(0).toUpperCase();
}

function formatNiche(value: string): string {
  if (value in INFLUENCER_NICHE_TAG_LABELS) {
    return INFLUENCER_NICHE_TAG_LABELS[value as InfluencerNicheTag];
  }
  return value;
}

function formatLanguage(value: string): string {
  if (value in INFLUENCER_LANGUAGE_LABELS) {
    return INFLUENCER_LANGUAGE_LABELS[value as InfluencerLanguage];
  }
  return value;
}

export default function CreatorPortalPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const profile = usePortalProfile(token ?? null);
  const collaborations = usePortalCollaborations(token ?? null);

  return (
    <main className="min-h-screen bg-cream text-ink px-4 py-5 sm:py-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center justify-between gap-3 mb-7">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[14px] bg-yellow text-obsidian grid place-items-center font-serif text-[24px] font-semibold shadow-sm">
              K
            </div>
            <div>
              <div className="font-serif text-[22px] leading-tight">
                {CREATOR_PORTAL_COPY.brandName}
              </div>
              <div className="eyebrow mt-1">
                {CREATOR_PORTAL_COPY.brandSubline}
              </div>
            </div>
          </div>
          <PortalThemeToggle />
        </header>

        {profile.isLoading && (
          <section className="card py-12 text-center">
            <div className="mx-auto mb-3 w-10 h-10 rounded-full border-2 border-line border-t-yellow animate-spin" />
            <p className="text-[13px] text-ink-3">
              {CREATOR_PORTAL_COPY.loading}
            </p>
          </section>
        )}

        {(profile.isError || (!token && !profile.isLoading)) && (
          <section className="card py-12 text-center">
            <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-yellow grid place-items-center text-obsidian">
              <MessageCircle size={19} />
            </div>
            <p className="text-[14px] text-ink-2 leading-relaxed max-w-md mx-auto">
              {CREATOR_PORTAL_COPY.invalidLink}
            </p>
          </section>
        )}

        {profile.data && (
          <div className="space-y-4">
            <PortalHero
              displayName={profile.data.displayName}
              city={profile.data.city}
              platforms={profile.data.platforms}
            />

            {profile.data.platforms.length > 0 && (
              <section>
                <div className="grid grid-cols-3 gap-2.5">
                  {profile.data.platforms.map((platform) => (
                    <PortalPlatformTile
                      key={platform.key}
                      platform={platform}
                    />
                  ))}
                </div>
              </section>
            )}

            <PortalReliabilitySection reliability={profile.data.reliability} />

            <PortalTagsCard
              nicheTags={profile.data.nicheTags}
              languages={profile.data.languages}
            />

            <ActiveCollaborations
              token={token ?? null}
              platforms={profile.data.platforms}
              collaborations={collaborations.data ?? []}
              isLoading={collaborations.isLoading}
            />
          </div>
        )}

        <footer className="py-8 text-center">
          <p className="text-[12px] text-ink-3">
            {CREATOR_PORTAL_COPY.footerBranding}
          </p>
          <p className="text-[12px] text-ink-3 mt-1">
            {CREATOR_PORTAL_COPY.contactLine}
          </p>
        </footer>
      </div>
    </main>
  );
}

function ActiveCollaborations({
  token,
  platforms,
  collaborations,
  isLoading,
}: {
  token: string | null;
  platforms: PortalPlatformView[];
  collaborations: PortalCollaboration[];
  isLoading: boolean;
}): JSX.Element {
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="h-card">{CREATOR_PORTAL_COPY.submissionsTitle}</h2>
        <span className="chip chip-default">{collaborations.length}</span>
      </div>
      {isLoading && (
        <p className="text-[13px] text-ink-3">{CREATOR_PORTAL_COPY.loading}</p>
      )}
      {!isLoading && collaborations.length === 0 && (
        <div className="rounded-md bg-yellow-bg border border-yellow/60 p-4 text-[13px] text-ink-2">
          {CREATOR_PORTAL_COPY.submissionsPlaceholder}
        </div>
      )}
      <div className="space-y-3">
        {collaborations.map((collaboration) => (
          <CollaborationCard
            key={collaboration.entryId}
            token={token}
            platforms={platforms}
            collaboration={collaboration}
            expanded={expandedEntryId === collaboration.entryId}
            onToggle={() =>
              setExpandedEntryId((current) =>
                current === collaboration.entryId ? null : collaboration.entryId,
              )
            }
          />
        ))}
      </div>
    </section>
  );
}

function CollaborationCard({
  token,
  platforms,
  collaboration,
  expanded,
  onToggle,
}: {
  token: string | null;
  platforms: PortalPlatformView[];
  collaboration: PortalCollaboration;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <div className="rounded-md border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-[14px] text-ink">{collaboration.title}</h3>
          <p className="text-[12px] text-ink-3 mt-1">
            {collaboration.targetDate} · {collaboration.status.replace("_", " ")}
          </p>
          {collaboration.description && (
            <p className="text-[12.5px] text-ink-2 mt-2 leading-relaxed">
              {collaboration.description}
            </p>
          )}
        </div>
        {collaboration.existingSubmission ? (
          <span className="chip status-active flex-shrink-0">
            Submitted
          </span>
        ) : (
          <button type="button" onClick={onToggle} className="btn btn-primary flex-shrink-0">
            {expanded ? "Close" : "Submit Post"}
          </button>
        )}
      </div>
      {collaboration.existingSubmission && (
        <SubmissionSummary submission={collaboration.existingSubmission} />
      )}
      {!collaboration.existingSubmission && expanded && (
        <PortalSubmissionForm
          token={token}
          platforms={platforms}
          entryId={collaboration.entryId}
        />
      )}
    </div>
  );
}

function SubmissionSummary({ submission }: { submission: PortalSubmissionView }): JSX.Element {
  const urls = [
    submission.tiktokPostUrl ? "TikTok" : null,
    submission.instagramPostUrl ? "Instagram" : null,
    submission.snapchatPostUrl ? "Snapchat" : null,
  ].filter((item): item is string => item !== null);
  return (
    <div className="mt-3 rounded-md bg-cream-2/50 p-3 text-[12.5px] text-ink-2">
      <div>Submitted on {new Date(submission.submittedAt).toLocaleDateString()}</div>
      <div className="mt-1">Platforms: {urls.join(", ")}</div>
      <div className="mt-1 capitalize">Verification: {submission.verificationStatus}</div>
    </div>
  );
}

function PortalSubmissionForm({
  token,
  platforms,
  entryId,
}: {
  token: string | null;
  platforms: PortalPlatformView[];
  entryId: string;
}): JSX.Element {
  const submit = useSubmitPortalPost(token);
  const [values, setValues] = useState({
    tiktokPostUrl: "",
    instagramPostUrl: "",
    snapchatPostUrl: "",
    taggedKayan: null as boolean | null,
    usedPromoCode: null as boolean | null,
    notes: "",
  });
  const [success, setSuccess] = useState(false);

  const setField = (field: keyof typeof values, value: string | boolean | null): void => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await submit.mutateAsync({
      entryId,
      tiktokPostUrl: values.tiktokPostUrl.trim() || null,
      instagramPostUrl: values.instagramPostUrl.trim() || null,
      snapchatPostUrl: values.snapchatPostUrl.trim() || null,
      taggedKayan: values.taggedKayan,
      usedPromoCode: values.usedPromoCode,
      notes: values.notes.trim() || null,
    });
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="mt-4 rounded-md bg-sage/30 text-[#2C5530] px-3 py-2 text-[13px]">
        Submitted. Kayan will verify it soon.
      </div>
    );
  }

  return (
    <form onSubmit={submitForm} className="mt-4 space-y-4 border-t border-line pt-4">
      {platforms.map((platform) => {
        const field =
          platform.key === "tiktok"
            ? "tiktokPostUrl"
            : platform.key === "instagram"
              ? "instagramPostUrl"
              : "snapchatPostUrl";
        return (
          <label key={platform.key} className="block">
            <span className="field-label">{platform.label} post URL</span>
            <input
              type="url"
              value={values[field]}
              onChange={(event) => setField(field, event.target.value)}
              className="form-input min-h-[44px]"
              placeholder="https://..."
            />
          </label>
        );
      })}

      <YesNoToggle
        label="Tagged Kayan?"
        value={values.taggedKayan}
        onChange={(value) => setField("taggedKayan", value)}
      />
      <YesNoToggle
        label="Used promo code?"
        value={values.usedPromoCode}
        onChange={(value) => setField("usedPromoCode", value)}
      />

      <label className="block">
        <span className="field-label">Notes</span>
        <textarea
          value={values.notes}
          onChange={(event) => setField("notes", event.target.value)}
          className="form-textarea"
          rows={3}
        />
      </label>

      {submit.isError && (
        <div className="rounded-md bg-rose/30 border border-rose-deep/30 text-[#6E2A35] px-3 py-2 text-[12.5px]">
          {submit.error instanceof Error ? submit.error.message : CREATOR_PORTAL_COPY.invalidLink}
        </div>
      )}

      <button type="submit" disabled={submit.isPending} className="btn btn-primary w-full justify-center min-h-[44px]">
        {submit.isPending ? "Submitting..." : "Submit post"}
      </button>
    </form>
  );
}

function YesNoToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="tab-group">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`tab ${value === true ? "tab-active" : ""}`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`tab ${value === false ? "tab-active" : ""}`}
        >
          No
        </button>
      </div>
    </div>
  );
}

const PORTAL_RELIABILITY_MIN_COLLABS = 3;

// Reliability section on the creator-facing portal. Gated by ≥3
// eligible collabs — fewer than that and we show a quiet "X more to
// go" message instead of a score that would yo-yo with each submission.
function PortalReliabilitySection({
  reliability,
}: {
  reliability: PortalReliabilityView;
}): JSX.Element {
  if (!reliability.available) {
    const remaining = Math.max(
      PORTAL_RELIABILITY_MIN_COLLABS - reliability.totalCollabs,
      1,
    );
    return (
      <section className="card">
        <h2 className="h-card mb-2">Your reliability</h2>
        <p className="text-[13px] text-ink-3 leading-relaxed">
          Your reliability score appears after{" "}
          {PORTAL_RELIABILITY_MIN_COLLABS} completed collaborations. You're{" "}
          {remaining} away.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="h-card mb-4">Your reliability</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PortalReliabilityCard
          label="Post rate"
          value={reliability.postRate}
          description="How often you post when we agree"
        />
        <PortalReliabilityCard
          label="Tag rate"
          value={reliability.tagRate}
          description="How often you tag Kayan in your posts"
        />
        <PortalReliabilityCard
          label="On-time rate"
          value={reliability.onTimeRate}
          description="How often you submit within 24 hours of the agreed post date"
        />
      </div>
      <p className="text-[12px] text-ink-3 italic mt-4">
        Keep your scores high to be invited to more campaigns.
      </p>
    </section>
  );
}

// Subtle background tint per rate band — matches the chip palette in
// the rest of the app (sage / yellow-bg / rose). Lets the number itself
// carry the visual weight without yelling.
function portalRateTintClass(value: number | null): string {
  if (value === null) return "bg-cream-2 border-line";
  if (value >= 80) return "bg-sage/30 border-sage-deep/30";
  if (value >= 50) return "bg-yellow-bg border-yellow/60";
  return "bg-rose/30 border-rose-deep/30";
}

function portalRateNumberColor(value: number | null): string {
  if (value === null) return "text-ink-3";
  if (value >= 80) return "text-[#2C5530]";
  if (value >= 50) return "text-obsidian";
  return "text-[#6E2A35]";
}

function PortalReliabilityCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number | null;
  description: string;
}): JSX.Element {
  return (
    <div
      className={`rounded-xl border p-4 text-center ${portalRateTintClass(value)}`}
    >
      <div
        className={`font-serif text-[34px] sm:text-[40px] font-semibold leading-none tabular-nums ${portalRateNumberColor(value)}`}
      >
        {value === null ? "—" : `${value}%`}
      </div>
      <div className="eyebrow mt-2.5">{label}</div>
      <p className="text-[11px] text-ink-3 leading-snug mt-1.5">
        {description}
      </p>
    </div>
  );
}

// Compact theme toggle for the portal header. The admin sidebar's
// ThemeToggle is full-width with a text label — not the right shape
// here. This is icon-only and lives in the top-right of the public
// portal so creators can flip between light and dark to match their
// device. Wires into the same useThemeStore so the choice persists
// across visits (localStorage).
function PortalThemeToggle(): JSX.Element {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid w-10 h-10 rounded-full bg-paper border border-line place-items-center text-ink-2 hover:text-ink hover:border-line-2 transition"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

// ─── Polished portal sections ────────────────────────────────────────────

// Hero card: big avatar + name + city + reach summary. Designed to be
// the one moment that says "this is YOUR profile" — like an Instagram
// profile header but in Kayan's serif/cream voice.
function PortalHero({
  displayName,
  city,
  platforms,
}: {
  displayName: string;
  city: string | null;
  platforms: PortalPlatformView[];
}): JSX.Element {
  const initial = avatarInitial(displayName);

  // Sum of follower counts across all platforms with a number. If none
  // have a count, we hide the reach line entirely — better to omit than
  // surface "0 across 0 platforms".
  const reachTotal = platforms.reduce(
    (sum, p) => sum + (p.followers ?? 0),
    0,
  );
  const platformsWithCount = platforms.filter((p) => p.followers !== null);
  const showReach = platformsWithCount.length > 0 && reachTotal > 0;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-paper border border-line shadow-sm">
      {/* Soft cream-to-paper backdrop strip behind the avatar — gives
          the hero a touch of depth without going full-gradient. */}
      <div className="absolute inset-x-0 top-0 h-24 bg-cream-2" aria-hidden />

      <div className="relative px-5 sm:px-7 pt-7 pb-6 text-center">
        <div className="inline-grid place-items-center w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-yellow text-obsidian shadow-md ring-4 ring-paper">
          <span className="font-serif text-[44px] sm:text-[52px] font-semibold leading-none">
            {initial}
          </span>
        </div>

        <h1 className="font-serif text-[28px] sm:text-[34px] leading-tight tracking-tight text-ink mt-4">
          {displayName}
        </h1>

        <div className="flex items-center justify-center gap-3 flex-wrap mt-2 text-[13px] text-ink-2">
          {city && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={13} className="text-ink-3" />
              {city}
            </span>
          )}
          {showReach && (
            <>
              {city && <span className="text-ink-3">·</span>}
              <span>
                <span className="font-semibold text-ink tabular-nums">
                  {formatCompactCount(reachTotal)}
                </span>{" "}
                across {platformsWithCount.length} platform
                {platformsWithCount.length === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>

        <p className="text-[12.5px] text-ink-3 leading-relaxed max-w-md mx-auto mt-4">
          {CREATOR_PORTAL_COPY.contactLine}
        </p>
      </div>
    </section>
  );
}

// One platform = one tile in a 3-col grid. Inspired by the stats row
// on Instagram profiles. Whole tile is clickable when there's a URL,
// otherwise it renders as a static card.
function PortalPlatformTile({
  platform,
}: {
  platform: PortalPlatformView;
}): JSX.Element {
  const hasUrl = Boolean(platform.url);
  const inner = (
    <>
      <div className="font-serif text-[22px] sm:text-[26px] font-semibold text-ink leading-none tabular-nums">
        {formatCompactCount(platform.followers)}
      </div>
      <div className="eyebrow mt-2">{platform.label}</div>
      <div
        className="text-[11.5px] text-ink-3 mt-1 truncate"
        title={`@${platform.handle}`}
      >
        @{platform.handle}
      </div>
    </>
  );

  if (hasUrl && platform.url) {
    return (
      <a
        href={platform.url}
        target="_blank"
        rel="noreferrer"
        className="block rounded-xl bg-paper border border-line p-3.5 text-center transition hover:border-line-2 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow"
        title={`Open ${platform.label}`}
      >
        {inner}
      </a>
    );
  }
  return (
    <div className="rounded-xl bg-paper border border-line p-3.5 text-center">
      {inner}
    </div>
  );
}

// Niche tags + languages combined into one card so the eye doesn't
// have to traverse two separate sections for what amounts to identity
// metadata.
function PortalTagsCard({
  nicheTags,
  languages,
}: {
  nicheTags: string[];
  languages: string[];
}): JSX.Element {
  const hasNiches = nicheTags.length > 0;
  const hasLanguages = languages.length > 0;
  if (!hasNiches && !hasLanguages) return <></>;

  return (
    <section className="card">
      <div className="space-y-4">
        {hasNiches && (
          <div>
            <div className="eyebrow mb-2">
              {CREATOR_PORTAL_COPY.nicheTagsTitle}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {nicheTags.map(formatNiche).map((tag) => (
                <span key={tag} className="chip chip-default">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        {hasLanguages && (
          <div>
            <div className="eyebrow mb-2">
              {CREATOR_PORTAL_COPY.languagesTitle}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {languages.map(formatLanguage).map((lang) => (
                <span key={lang} className="chip chip-default">
                  {lang}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

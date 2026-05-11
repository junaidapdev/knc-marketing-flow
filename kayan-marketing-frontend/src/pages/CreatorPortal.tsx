import { useState } from "react";
import {
  AtSign,
  ExternalLink,
  MapPin,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { CREATOR_PORTAL_COPY } from "../constants/portal";
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

function formatCount(value: number | null): string {
  if (value === null) return CREATOR_PORTAL_COPY.notSet;
  return value.toLocaleString();
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
          <div className="hidden sm:grid w-10 h-10 rounded-full bg-paper border border-line place-items-center text-yellow">
            <Sparkles size={18} />
          </div>
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
            <section className="rounded-lg bg-paper border border-line shadow-sm p-5 sm:p-6">
              <p className="eyebrow mb-2">{CREATOR_PORTAL_COPY.brandSubline}</p>
              <h1 className="font-serif text-[30px] sm:text-[38px] leading-tight tracking-tight">
                {CREATOR_PORTAL_COPY.welcome}, {profile.data.displayName}
              </h1>
              <p className="text-[13.5px] text-ink-2 mt-3 leading-relaxed">
                {CREATOR_PORTAL_COPY.contactLine}
              </p>
            </section>

            <section className="card">
              <h2 className="h-card mb-4">
                {CREATOR_PORTAL_COPY.profileTitle}
              </h2>
              <div className="space-y-5">
                <div>
                  <div className="eyebrow mb-2">
                    {CREATOR_PORTAL_COPY.cityLabel}
                  </div>
                  <div className="flex items-center gap-2 text-[14px] text-ink">
                    <MapPin size={15} className="text-ink-3" />
                    <span>
                      {profile.data.city ?? CREATOR_PORTAL_COPY.notSet}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="eyebrow mb-2">
                    {CREATOR_PORTAL_COPY.platformsTitle}
                  </div>
                  {profile.data.platforms.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {profile.data.platforms.map((platform) => (
                        <PlatformRow key={platform.key} platform={platform} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-ink-3">
                      {CREATOR_PORTAL_COPY.noPlatforms}
                    </p>
                  )}
                </div>

                <ChipGroup
                  title={CREATOR_PORTAL_COPY.nicheTagsTitle}
                  values={profile.data.nicheTags.map(formatNiche)}
                  empty={CREATOR_PORTAL_COPY.noTags}
                />

                <ChipGroup
                  title={CREATOR_PORTAL_COPY.languagesTitle}
                  values={profile.data.languages.map(formatLanguage)}
                  empty={CREATOR_PORTAL_COPY.noLanguages}
                />
              </div>
            </section>

            <PortalReliabilitySection reliability={profile.data.reliability} />

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

function PlatformRow({
  platform,
}: {
  platform: PortalPlatformView;
}): JSX.Element {
  const content = (
    <>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-cream-2 grid place-items-center text-ink-2 flex-shrink-0">
          <AtSign size={17} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[14px] text-ink">
            {platform.label}
          </div>
          <div className="text-[12.5px] text-ink-2 truncate">
            {platform.handle}
          </div>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[13px] font-semibold text-ink">
          {formatCount(platform.followers)}
        </div>
        <div className="text-[11px] text-ink-3">
          {CREATOR_PORTAL_COPY.followersLabel}
        </div>
      </div>
    </>
  );

  if (!platform.url) {
    return (
      <div className="rounded-md border border-line p-3 flex items-center justify-between gap-3">
        {content}
      </div>
    );
  }

  return (
    <a
      href={platform.url}
      target="_blank"
      rel="noreferrer"
      className="rounded-md border border-line p-3 flex items-center justify-between gap-3 hover:bg-cream-2/30 transition min-h-[68px]"
      aria-label={`${CREATOR_PORTAL_COPY.openProfile} ${platform.label}`}
    >
      {content}
      <ExternalLink size={14} className="text-ink-3 flex-shrink-0" />
    </a>
  );
}

function ChipGroup({
  title,
  values,
  empty,
}: {
  title: string;
  values: string[];
  empty: string;
}): JSX.Element {
  return (
    <div>
      <div className="eyebrow mb-2">{title}</div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="chip chip-default">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-ink-3">{empty}</p>
      )}
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

function portalRateChipClass(value: number | null): string {
  if (value === null) return "bg-cream-2 text-ink-3";
  if (value >= 80) return "bg-sage text-[#2C5530]";
  if (value >= 50) return "bg-yellow text-obsidian";
  return "bg-rose text-[#6E2A35]";
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
    <div className="rounded-md border border-line p-3 bg-paper">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="eyebrow">{label}</span>
        <span
          className={`chip ${portalRateChipClass(value)} font-semibold !text-[11px]`}
        >
          {value === null ? "—" : `${value}%`}
        </span>
      </div>
      <p className="text-[11.5px] text-ink-3 leading-snug">{description}</p>
    </div>
  );
}

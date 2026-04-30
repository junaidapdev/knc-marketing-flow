import { useEffect, useState } from "react";
import { Save, Check } from "lucide-react";
import { useCurrentBrand } from "../hooks/use-current-brand";
import { useBrand, useUpdateBrand } from "../features/brand/hooks/use-brand";
import type { BrandVoiceConfig } from "../types/brand";
import { logger } from "../utils/logger";

// Convert a comma- or newline-separated string into a clean string array
// (used for do_say / dont_say / default_hashtags fields).
function parseList(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function joinList(arr: string[] | undefined): string {
  return Array.isArray(arr) ? arr.join(", ") : "";
}

export default function SettingsPage(): JSX.Element {
  const { brandId } = useCurrentBrand();
  const brand = useBrand(brandId);
  const updateBrand = useUpdateBrand();

  // Form state — kept local until Save is pressed. Voice config is split
  // into known structured fields so the marketer doesn't have to write JSON;
  // any extra keys in the existing voice_config are preserved on merge.
  const [tone, setTone] = useState("");
  const [primaryLang, setPrimaryLang] = useState("");
  const [secondaryLang, setSecondaryLang] = useState("");
  const [audience, setAudience] = useState("");
  const [keyPositioning, setKeyPositioning] = useState("");
  const [defaultHashtags, setDefaultHashtags] = useState("");
  const [doSay, setDoSay] = useState("");
  const [dontSay, setDontSay] = useState("");
  const [dna, setDna] = useState("");
  // Social handles drive the Apify ingest on the Performance page. Stored as
  // bare usernames (no @, no full URL) — the Edge Function constructs the
  // scrape input from these.
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  // Production rhythm — defaults applied to new entries and to the calendar
  // shoot-day capacity warnings.
  const [shootCapacity, setShootCapacity] = useState("4");
  const [editorOffset, setEditorOffset] = useState("2");
  const [schedulingBuffer, setSchedulingBuffer] = useState("3");
  const [savedFlash, setSavedFlash] = useState(false);

  // Hydrate the form from the loaded brand.
  useEffect(() => {
    if (!brand.data) return;
    const v = (brand.data.voiceConfig ?? {}) as BrandVoiceConfig;
    setTone(typeof v.tone === "string" ? v.tone : "");
    setPrimaryLang(typeof v.primary_language === "string" ? v.primary_language : "");
    setSecondaryLang(typeof v.secondary_language === "string" ? v.secondary_language : "");
    setAudience(typeof v.audience === "string" ? v.audience : "");
    setKeyPositioning(typeof v.key_positioning === "string" ? v.key_positioning : "");
    setDefaultHashtags(joinList(v.default_hashtags));
    setDoSay(joinList(v.do_say));
    setDontSay(joinList(v.dont_say));
    setDna(brand.data.dnaMarkdown ?? "");
    setInstagramHandle(brand.data.instagramHandle ?? "");
    setTiktokHandle(brand.data.tiktokHandle ?? "");
    setShootCapacity(String(brand.data.defaultShootCapacity ?? 4));
    setEditorOffset(String(brand.data.defaultEditorOffset ?? 2));
    setSchedulingBuffer(String(brand.data.defaultSchedulingBuffer ?? 3));
  }, [brand.data]);

  const onSave = async (): Promise<void> => {
    if (!brand.data) return;
    const previousVoice = (brand.data.voiceConfig ?? {}) as BrandVoiceConfig;
    // Merge — preserves any keys not exposed in the form.
    const nextVoice: BrandVoiceConfig = {
      ...previousVoice,
      tone: tone.trim() || undefined,
      primary_language: primaryLang.trim() || undefined,
      secondary_language: secondaryLang.trim() || undefined,
      audience: audience.trim() || undefined,
      key_positioning: keyPositioning.trim() || undefined,
      default_hashtags: parseList(defaultHashtags),
      do_say: parseList(doSay),
      dont_say: parseList(dontSay),
    };
    try {
      const parseInt0 = (s: string, fallback: number): number => {
        const n = parseInt(s, 10);
        return Number.isFinite(n) && n >= 0 ? n : fallback;
      };
      await updateBrand.mutateAsync({
        id: brand.data.id,
        input: {
          voiceConfig: nextVoice,
          dnaMarkdown: dna.trim().length > 0 ? dna : null,
          instagramHandle: instagramHandle.trim().length > 0 ? instagramHandle.trim() : null,
          tiktokHandle: tiktokHandle.trim().length > 0 ? tiktokHandle.trim() : null,
          defaultShootCapacity: parseInt0(shootCapacity, 4),
          defaultEditorOffset: parseInt0(editorOffset, 2),
          defaultSchedulingBuffer: parseInt0(schedulingBuffer, 3),
        },
      });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      logger.error("save brand failed", { err: String(err) });
    }
  };

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12 space-y-6 md:space-y-7">
      <header>
        <h1 className="h-greeting text-[24px] md:text-[30px]">
          Settings <em>and brand voice</em>
        </h1>
        <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
          Voice and Brand DNA are read by the AI assistant on every generation.
        </p>
      </header>

      {brand.isLoading && <p className="text-ink-3 text-[13px]">Loading brand…</p>}
      {brand.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 text-[13px]">
          {brand.error instanceof Error ? brand.error.message : "Failed to load brand."}
        </div>
      )}

      {brand.data && (
        <>
          <section className="card space-y-4">
            <div>
              <h2 className="h-card">Brand voice</h2>
              <p className="text-[12.5px] text-ink-3 mt-0.5">
                Short, structured fields. Used as a quick-reference layer in every AI prompt.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Tone</label>
                <input
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="warm, energetic, value-conscious"
                  className="form-input"
                />
              </div>
              <div>
                <label className="field-label">Audience</label>
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="youth impulse buyers + bulk family shoppers"
                  className="form-input"
                />
              </div>
              <div>
                <label className="field-label">Primary language</label>
                <input
                  value={primaryLang}
                  onChange={(e) => setPrimaryLang(e.target.value)}
                  placeholder="Arabic"
                  className="form-input"
                />
              </div>
              <div>
                <label className="field-label">Secondary language</label>
                <input
                  value={secondaryLang}
                  onChange={(e) => setSecondaryLang(e.target.value)}
                  placeholder="English"
                  className="form-input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="field-label">Key positioning</label>
                <input
                  value={keyPositioning}
                  onChange={(e) => setKeyPositioning(e.target.value)}
                  placeholder="11.50 SR fixed-price destination, premium boxed chocolates at select branches"
                  className="form-input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="field-label">Default hashtags</label>
                <input
                  value={defaultHashtags}
                  onChange={(e) => setDefaultHashtags(e.target.value)}
                  placeholder="#KayanSweets, #حلويات_كيان"
                  className="form-input"
                />
                <p className="text-[11px] text-ink-3 mt-1">Comma-separated.</p>
              </div>
              <div>
                <label className="field-label">Do say</label>
                <textarea
                  value={doSay}
                  onChange={(e) => setDoSay(e.target.value)}
                  placeholder="affordable indulgence, family treats"
                  rows={3}
                  className="form-textarea"
                />
                <p className="text-[11px] text-ink-3 mt-1">Comma- or newline-separated.</p>
              </div>
              <div>
                <label className="field-label">Don't say</label>
                <textarea
                  value={dontSay}
                  onChange={(e) => setDontSay(e.target.value)}
                  placeholder="cheap, low-quality, discount"
                  rows={3}
                  className="form-textarea"
                />
                <p className="text-[11px] text-ink-3 mt-1">Comma- or newline-separated.</p>
              </div>
            </div>
          </section>

          <section className="card space-y-4">
            <div>
              <h2 className="h-card">Production rhythm</h2>
              <p className="text-[12.5px] text-ink-3 mt-0.5">
                Defaults for batch shoot days. Applied to every new video entry —
                editable per entry.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="field-label">Shoot day capacity</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={shootCapacity}
                  onChange={(e) => setShootCapacity(e.target.value)}
                  className="form-input"
                />
                <p className="text-[11px] text-ink-3 mt-1">
                  Soft warning when a single shoot day has more than this many entries.
                </p>
              </div>
              <div>
                <label className="field-label">Editor turnaround (days)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={editorOffset}
                  onChange={(e) => setEditorOffset(e.target.value)}
                  className="form-input"
                />
                <p className="text-[11px] text-ink-3 mt-1">
                  How many days after shoot day the edit task is due.
                </p>
              </div>
              <div>
                <label className="field-label">Scheduling buffer (days)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={schedulingBuffer}
                  onChange={(e) => setSchedulingBuffer(e.target.value)}
                  className="form-input"
                />
                <p className="text-[11px] text-ink-3 mt-1">
                  Days before live date that content must be queued in the platform.
                </p>
              </div>
            </div>
          </section>

          <section className="card space-y-4">
            <div>
              <h2 className="h-card">Social handles</h2>
              <p className="text-[12.5px] text-ink-3 mt-0.5">
                Used by the Performance page's "Refresh from Apify" button to scrape live
                follower counts and recent posts. Bare usernames only — no @, no URL.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Instagram handle</label>
                <input
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  placeholder="kayan_sweets"
                  className="form-input"
                />
              </div>
              <div>
                <label className="field-label">TikTok handle</label>
                <input
                  value={tiktokHandle}
                  onChange={(e) => setTiktokHandle(e.target.value)}
                  placeholder="kayan_sweets"
                  className="form-input"
                />
              </div>
            </div>
          </section>

          <section className="card space-y-4">
            <div>
              <h2 className="h-card">Brand DNA</h2>
              <p className="text-[12.5px] text-ink-3 mt-0.5">
                The long-form bible. Mission, values, audience personas, content pillars,
                competitor positioning, example top-performing posts. Markdown supported.
                Injected verbatim into every AI generation.
              </p>
            </div>
            <textarea
              value={dna}
              onChange={(e) => setDna(e.target.value)}
              rows={20}
              maxLength={50000}
              placeholder={`# Mission\nKayan makes joy affordable: 11.50 SR fixed price, no-haggle...\n\n# Audience personas\n- **The treat-grabber** — youth, IG/TikTok-native...\n- **The family stocker** — bulk buyer, weekly run...\n\n# Content pillars\n1. Product showcase (40%) — close-up textures, sound design\n2. Trend riffs (30%) — local Saudi trend audio\n3. Behind the scenes (20%) — staff candor\n4. Offers (10%) — countdown clarity\n\n# Reference posts (what worked)\n- Eid teaser, Apr 2025: 480k plays — secret was the 3-second product reveal hook\n- ...`}
              className="form-textarea font-mono text-[13px] leading-relaxed"
            />
            <p className="text-[11px] text-ink-3">{dna.length} / 50,000 characters</p>
          </section>

          {updateBrand.isError && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-3 text-[12.5px]">
              {updateBrand.error instanceof Error
                ? updateBrand.error.message
                : "Save failed."}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            {savedFlash && (
              <span className="flex items-center gap-1.5 text-[13px] text-sage-deep">
                <Check size={14} />
                Saved
              </span>
            )}
            <button
              onClick={onSave}
              disabled={updateBrand.isPending}
              className="btn btn-primary disabled:opacity-50"
            >
              <Save size={14} />
              {updateBrand.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

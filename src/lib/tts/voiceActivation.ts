import type { CharacterRow } from "@/lib/db/stories";
import { PROTAGONIST_SPEAKER_SLUG } from "@/lib/story/protagonist";
import type { StorySettings } from "@/lib/types";

/** When undefined, every mapped cast slug may use its own voice (legacy). */
export type VoiceEnabledSlugs = string[] | undefined;

export function normalizeVoiceSlug(input: string): string {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 0 && t !== "s")
    .join("");
}

export function isCastVoiceActive(
  speakerSlug: string | null | undefined,
  enabledSlugs: VoiceEnabledSlugs,
): boolean {
  const slug = speakerSlug?.trim().toLowerCase();
  if (!slug || slug === "narrator") return false;
  if (slug === PROTAGONIST_SPEAKER_SLUG) return true;
  if (enabledSlugs === undefined) return true;
  const target = normalizeVoiceSlug(slug);
  return enabledSlugs.some(
    (e) =>
      e.toLowerCase() === slug || normalizeVoiceSlug(e) === target,
  );
}

export function filterSegmentOverridesForActivation(
  overrides: Record<string, string> | undefined,
  enabledSlugs: VoiceEnabledSlugs,
): Record<string, string> {
  if (!overrides || enabledSlugs === undefined) return overrides ?? {};
  const out: Record<string, string> = {};
  for (const [snippet, slug] of Object.entries(overrides)) {
    if (!snippet.trim() || !slug || slug === "narrator") continue;
    if (slug === PROTAGONIST_SPEAKER_SLUG) {
      out[snippet] = slug;
      continue;
    }
    if (isCastVoiceActive(slug, enabledSlugs)) {
      out[snippet] = slug;
    }
  }
  return out;
}

/** Default enabled slugs when loading voices UI (all active cast). */
export function defaultEnabledCastSlugs(cast: CharacterRow[]): string[] {
  return cast
    .filter((c) => c.role === "cast" && (c.status ?? "active") === "active")
    .map((c) => c.slug);
}

export function readVoiceEnabledSlugs(
  settings: StorySettings,
): VoiceEnabledSlugs {
  return settings.voiceEnabledSlugs;
}

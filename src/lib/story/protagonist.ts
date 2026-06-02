import type {
  StoryProtagonistProfile,
  StorySettings,
  VoiceMap,
} from "@/lib/types";

/** TTS / script slug for the player character (separate from scene narrator). */
export const PROTAGONIST_SPEAKER_SLUG = "protagonist";

export type StoryContentLocale = "de" | "en";

export function normalizeStoryContentLocale(
  locale: string | null | undefined,
): StoryContentLocale {
  return locale?.toLowerCase().startsWith("de") ? "de" : "en";
}

export function needsProtagonistSetup(settings: StorySettings): boolean {
  return !settings.protagonist?.displayName?.trim();
}

export function defaultProtagonistProfile(
  locale: StoryContentLocale,
): StoryProtagonistProfile {
  return locale === "de"
    ? { displayName: "Du", pronouns: "du", gender: "neutral" }
    : { displayName: "You", pronouns: "you", gender: "neutral" };
}

export function protagonistPromptBlock(
  profile: StoryProtagonistProfile,
  locale: StoryContentLocale,
): string {
  const name = profile.displayName.trim();
  const pronouns = profile.pronouns.trim();
  if (locale === "de") {
    return `## Spieler-Protagonist
Name: ${name}
Anrede im Text: zweite Person (${pronouns === "sie" ? "Sie" : pronouns === "er" ? "er" : "du"})
Geschlecht (Hintergrund): ${profile.gender ?? "neutral"}
- Szene/Erzählung → \`<<speaker:narrator>>\`
- Gesprochene Zeilen des Spielers → \`<<speaker:protagonist>>\` (nicht Cast-Slugs).`;
  }
  return `## Player protagonist
Name: ${name}
Address: second person (${pronouns})
Gender (background): ${profile.gender ?? "neutral"}
- Scene prose → \`<<speaker:narrator>>\`
- Player spoken lines → \`<<speaker:protagonist>>\` (not a cast slug).`;
}

/** Ensure voice map has a protagonist entry (defaults to narrator voice). */
export function withProtagonistVoice(map: VoiceMap): VoiceMap {
  const narrator = map.narrator?.trim();
  if (!narrator) return map;
  if (map[PROTAGONIST_SPEAKER_SLUG]?.trim()) return map;
  return { ...map, [PROTAGONIST_SPEAKER_SLUG]: narrator };
}

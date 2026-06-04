import type { CharacterRow } from "@/lib/db/stories";
import {
  PROTAGONIST_SPEAKER_SLUG,
  type StoryContentLocale,
} from "@/lib/story/protagonist";
import type { StoryProtagonistProfile } from "@/lib/types";

const NPC_SLUGS = [
  "npc:mother",
  "npc:father",
  "npc:sister",
  "npc:brother",
] as const;

/** Instructions appended to every storyteller chat system prompt. */
export function buildStorytellerScriptInstructions(
  cast: CharacterRow[],
  locale: StoryContentLocale = "en",
  protagonist?: StoryProtagonistProfile | null,
): string {
  const castSlugs = cast
    .filter((c) => c.role === "cast" && (c.status ?? "active") === "active")
    .map((c) => `\`${c.slug}\` (${c.name})`);
  const slugList = [
    "`narrator` (scene description only — no character dialogue)",
    `\`${PROTAGONIST_SPEAKER_SLUG}\` (player / protagonist spoken lines)`,
    ...castSlugs,
    ...NPC_SLUGS.map((s) => `\`${s}\``),
    "`guest:<name>` only when someone speaks who is not listed above",
  ];

  const playerName =
    protagonist?.displayName?.trim() ||
    (locale === "de" ? "der Spieler" : "the player");

  if (locale === "de") {
    return `## Dialog-Skript (Pflicht in jeder Antwort)

Markiere **wer spricht**, damit TTS die richtige Stimme nutzen kann.

Format: \`<<speaker:slug>>\` in einer eigenen Zeile, danach Absatz (Prosa und/oder Zitat). Wechsel das Tag bei jedem Sprecherwechsel.

Regeln:
- Start mit \`<<speaker:narrator>>\` oder dem ersten Sprecher-Tag.
- Jedes Tag **eigene Zeile** — nie mitten im Satz.
- Szene / Erzählung → \`<<speaker:narrator>>\`
- Gesprochene Zeilen von ${playerName} (Zweite Person „du“) → \`<<speaker:${PROTAGONIST_SPEAKER_SLUG}>>\`, nicht Cast-Slugs.
- Zitate anderer Figuren → deren Cast-Slug, auch wenn „du“ im selben Absatz vorkommt.
- Deutsche Anführungszeichen: „…“
- Gäste: \`<<speaker:guest:name>>\` (kleingeschrieben).
- Nur Figuren, die **in der Szene anwesend** sind, dürfen sprechen.
- **Kein** Quest-Menü, \`[QUEST-OPTION]\`, Interface-Text, HP/Stufen-Zeilen oder „Was tust du?“ — nur erzählte Szene.
- Gültige Slugs: ${slugList.join(", ")}.

Beispiel:
<<speaker:narrator>>
Die Wirtin wischt sich die Hände ab und sieht dich an.

<<speaker:marta>>
„Noch ein Reisender im Nebel?“

<<speaker:${PROTAGONIST_SPEAKER_SLUG}>>
„Ich suche nur ein trockenes Zimmer.“

<<speaker:marta>>
„Dann hast du Glück — wenn du pünktlich zahlst.“`;
  }

  return `## Dialogue script (required for every reply)

Mark **who is speaking** with inline tags so audio uses the correct voice.

Format: \`<<speaker:slug>>\` on its own line, then that speaker's paragraph (prose and/or quoted dialogue). Switch tags whenever the speaker changes.

Rules:
- Start with \`<<speaker:narrator>>\` or the first speaker's tag.
- **Each tag on its own line** — never embed tags inside a sentence.
- Scene prose → \`<<speaker:narrator>>\`
- ${playerName}'s spoken lines (second person "you") → \`<<speaker:${PROTAGONIST_SPEAKER_SLUG}>>\`, not a cast slug.
- Another character's quoted line uses **their** slug even if "you" appears nearby.
- Guest speakers: \`<<speaker:guest:name>>\` (lowercase after guest:).
- Only cast who are **physically present** may speak.
- **No** quest menus, \`[QUEST-OPTION]\`, interface text, HP/level lines, or "What do you do?" — only lived-in scene prose.
- Valid slugs: ${slugList.join(", ")}.

Example:
<<speaker:narrator>>
Rain drums on the shingles as you push the door open.

<<speaker:naya-vellen>>
"You did it," she says simply.

<<speaker:${PROTAGONIST_SPEAKER_SLUG}>>
"We're not done yet." You gesture toward the desk.

<<speaker:naya-vellen>>
"Then tell me what you need."`;
}

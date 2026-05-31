import type { CharacterRow } from "@/lib/db/stories";

const NPC_SLUGS = [
  "npc:mother",
  "npc:father",
  "npc:sister",
  "npc:brother",
] as const;

/** Instructions appended to every storyteller chat system prompt. */
export function buildStorytellerScriptInstructions(
  cast: CharacterRow[],
): string {
  const castSlugs = cast
    .filter((c) => c.role === "cast" && (c.status ?? "active") === "active")
    .map((c) => `\`${c.slug}\` (${c.name})`);
  const slugList = [
    "`narrator` (scene prose and the protagonist's spoken lines)",
    ...castSlugs,
    ...NPC_SLUGS.map((s) => `\`${s}\``),
    "`guest:<name>` only when someone speaks who is not listed above (e.g. guest:zarek)",
  ];

  return `## Dialogue script (required for every reply)

You write one continuous scene. **Mark who is speaking** with inline tags so audio can use the correct voice.

Format: \`<<speaker:slug>>\` on its own line, then that speaker's paragraph (prose and/or quoted dialogue). Switch tags whenever the speaker changes — including back to \`<<speaker:narrator>>\` for scene description and for the protagonist's lines.

Rules:
- Start the reply with \`<<speaker:narrator>>\` or the first speaker's tag.
- **Each tag must be on its own line** — never embed \`<<speaker:…>>\` inside a sentence or paragraph.
- Put a tag before **each** stretch of text by a different speaker. Do not rely on the reader inferring speakers from nearby names.
- Protagonist dialogue (including lines like "We're not done yet." or "How many?") uses \`<<speaker:narrator>>\`, not a cast member mentioned in the same paragraph.
- Another character's quoted line uses **their** slug even if the protagonist or someone else is named nearby.
- Guest speakers: \`<<speaker:guest:zarek>>\` (lowercase name after guest:).
- Keep normal literary prose and punctuation; tags are stripped in the reader UI.
- **Presence:** Only cast members who are physically in the current scene may speak. If plot state lists someone as absent or at a future meeting, do NOT give them dialogue until they explicitly return in the scene.
- Valid slugs for this story: ${slugList.join(", ")}.

Example:
<<speaker:naya-vellen>>
"You did it," she says simply.

<<speaker:narrator>>
"We're not done yet." You gesture toward Marcus, who's just finished another call. "How many?"

<<speaker:marcus>>
Marcus looks up from his notes. "Seventeen communities confirmed so far."

<<speaker:guest:zarek>>
Zarek exhales. "I am Zarek of the Kevali. We have too many."`;
}

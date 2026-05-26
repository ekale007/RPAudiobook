import type { PromptContext } from "@/lib/prompt/buildPrompt";
import { buildChatMessages } from "@/lib/prompt/buildPrompt";
import type { CharacterRow } from "@/lib/db/stories";

function formatCastCard(c: CharacterRow): string {
  const card = c.card_json;
  const parts = [`### ${c.name} (slug: \`${c.slug}\`)`];
  if (card.description) parts.push(card.description);
  if (card.personality) parts.push(`Personality: ${card.personality}`);
  return parts.join("\n");
}

export function buildGroupChatMessages(
  ctx: PromptContext,
  cast: CharacterRow[],
): ReturnType<typeof buildChatMessages> {
  const base = buildChatMessages(ctx);
  const castLines = cast
    .filter((c) => c.role === "cast")
    .map(formatCastCard)
    .join("\n\n");

  const groupRules = `## Group roleplay mode

You control the narrator AND the cast. The user plays the protagonist only.

Output one or more blocks using this exact format (one block per speaker turn):

<<speaker:narrator>>
Second-person narration ("You…"). Scene description.

<<speaker:naya-vellen>>
That character's dialogue or action in third person.

Available speaker slugs:
- \`narrator\` — scene narration, second person for the user
${cast.map((c) => `- \`${c.slug}\` — ${c.name}`).join("\n")}

Rules:
- Use only the slugs listed above.
- Never write <<speaker:user>> or speak as the user.
- Alternate naturally between narrator and characters.
- End on a pause that invites the user to act or speak.
- Do not wrap blocks in markdown code fences.

## Cast reference

${castLines || "(no cast loaded)"}`;

  const system = `${base.messages[0]?.content ?? ""}\n\n${groupRules}`;

  return {
    messages: [{ role: "system", content: system }, ...base.messages.slice(1)],
    activeLoreCount: base.activeLoreCount,
  };
}

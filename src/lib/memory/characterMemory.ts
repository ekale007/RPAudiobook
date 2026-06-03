import { completeOpenRouter } from "@/lib/llm/openrouter";
import { parseModelJson } from "@/lib/llm/parseModelJson";import type { CharacterRow } from "@/lib/db/stories";
import type { ChatTurn, OpenRouterSettings, StoryCharacterCard } from "@/lib/types";

export type CharacterCastStatus = "active" | "archived";

export type CharacterMemoryUpdate = {
  slug: string;
  name: string;
  action: "create" | "update" | "archive";
  memory: string;
  archiveReason?: string | null;
};

export function slugifyCharacterName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function formatTurnLine(t: ChatTurn): string {
  if (t.role === "system") return "";
  const who =
    t.speakerSlug && t.speakerSlug !== "narrator"
      ? `${t.role} (${t.speakerSlug})`
      : t.role;
  return `${who}: ${t.content}`;
}

function buildTranscript(turns: ChatTurn[], maxChars = 40000): string {
  const full = turns
    .filter((t) => t.role !== "system")
    .map(formatTurnLine)
    .filter(Boolean)
    .join("\n\n");
  if (full.length <= maxChars) return full;
  return `[…earlier omitted…]\n\n${full.slice(-maxChars)}`;
}

function parseJsonFromModel(raw: string): unknown {
  return parseModelJson(raw);
}
export function formatCastMemoryForPrompt(
  characters: CharacterRow[],
): string | null {
  const cast = characters.filter((c) => c.role === "cast");
  if (!cast.length) return null;

  const active = cast.filter((c) => (c.status ?? "active") === "active");
  const archived = cast.filter((c) => c.status === "archived");

  const lines: string[] = [
    "## Cast memory (characters)",
    "Physical presence in the **current scene** comes from Plot state (Present / Absent / Scheduled) — not this block.",
  ];

  if (active.length) {
    lines.push("", "### Active in story");
    for (const c of active) {
      lines.push(`**${c.name}** (\`${c.slug}\`)`);
      if (c.character_memory?.trim()) {
        lines.push(c.character_memory.trim());
      } else {
        lines.push("(No memory yet.)");
      }
      lines.push("");
    }
  }

  if (archived.length) {
    lines.push("### Archived (death, departure, or left story)");
    lines.push(
      "Do NOT bring these characters back as alive/present unless the player or scene explicitly revives or recalls them.",
    );
    for (const c of archived) {
      const reason = c.archived_reason ? ` — ${c.archived_reason}` : "";
      lines.push(`**${c.name}** (\`${c.slug}\`)${reason}`);
      if (c.character_memory?.trim()) {
        lines.push(c.character_memory.trim());
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

export async function extractCharacterMemoryUpdates(
  settings: OpenRouterSettings,
  turns: ChatTurn[],
  existingCast: CharacterRow[],
  opts?: { chapterTitle?: string },
): Promise<CharacterMemoryUpdate[]> {
  if (!turns.some((t) => t.role !== "system")) return [];

  const roster = existingCast
    .filter((c) => c.role === "cast")
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      status: c.status ?? "active",
      memory: c.character_memory ?? "",
    }));

  const messages = [
    {
      role: "system",
      content: `You track CAST characters for an interactive RPG (not the player protagonist).

Return ONLY valid JSON:
{"characters":[{"slug":"snake_case","name":"Display Name","action":"create|update|archive","memory":"2-4 sentences: role, relationship, **Location:** where they are now, **In scene:** yes|no, last known state & attitude","archiveReason":"death|departure|left|unknown|null"}]}

Rules:
- Only named characters who matter in the story (not generic "guard" unless named).
- "create" = new character appearing for the first time (pick a new slug from name).
- "update" = existing character; refresh memory from latest transcript.
- "archive" = died, left the story permanently, imprisoned long-term, or otherwise gone from the active story entirely.
- **Leaving the scene temporarily** (went home, agreed to meet later, walked away) = "update" with **In scene: no** and their current location — do NOT archive unless they left the story for good.
- For archive: memory should note how they left and what people know.
- Use existing slugs when the character is already in the roster.
- Do not archive the player protagonist.
- If no changes needed, return {"characters":[]}.`,
    },
    {
      role: "user",
      content: [
        opts?.chapterTitle ? `Chapter: ${opts.chapterTitle}` : null,
        `Current roster:\n${JSON.stringify(roster, null, 2)}`,
        `Transcript:\n${buildTranscript(turns)}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  const raw = await completeOpenRouter(settings, messages, {
    maxTokens: 1200,
    temperature: 0.2,
  });

  const parsed = parseJsonFromModel(raw) as {
    characters?: Array<Partial<CharacterMemoryUpdate>>;
  } | null;

  if (!parsed?.characters?.length) return [];

  return parsed.characters
    .map((c) => normalizeUpdate(c, existingCast))
    .filter((c): c is CharacterMemoryUpdate => c !== null);
}

function normalizeUpdate(
  raw: Partial<CharacterMemoryUpdate>,
  existingCast: CharacterRow[],
): CharacterMemoryUpdate | null {
  const name = raw.name?.trim();
  const memory = raw.memory?.trim();
  if (!name || !memory) return null;

  let slug = raw.slug?.trim().toLowerCase().replace(/_/g, "-") ?? "";
  if (!slug) slug = slugifyCharacterName(name);

  const match = existingCast.find(
    (c) =>
      c.role === "cast" &&
      (c.slug === slug ||
        c.name.toLowerCase() === name.toLowerCase() ||
        slugifyCharacterName(c.name) === slug),
  );
  if (match) slug = match.slug;

  const action =
    raw.action === "create" ||
    raw.action === "update" ||
    raw.action === "archive"
      ? raw.action
      : match
        ? "update"
        : "create";

  return {
    slug,
    name: match?.name ?? name,
    action,
    memory,
    archiveReason:
      typeof raw.archiveReason === "string" ? raw.archiveReason : null,
  };
}

export function minimalCharacterCard(name: string): StoryCharacterCard {
  return {
    name,
    description: "Character discovered during play.",
    personality: "",
  };
}

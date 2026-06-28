import { completeOpenRouter } from "@/lib/llm/openrouter";
import { parseModelJson } from "@/lib/llm/parseModelJson";import type { CharacterRow } from "@/lib/db/stories";
import type { ChatTurn, OpenRouterSettings, StoryCharacterCard } from "@/lib/types";

export type CharacterCastStatus = "active" | "archived";

export type CharacterMemoryUpdate = {
  slug: string;
  name: string;
  action: "create" | "update" | "archive";
  /** Structured facts — see CharacterSheet. May be missing on partial updates. */
  sheet?: CharacterSheet;
  /** Pre-formatted memory text (fallback / quick path). */
  memory: string;
  archiveReason?: string | null;
};

/**
 * Phase 2: structured character sheet. Stored as a JSON envelope inside
 * `character_memory` (which historically was a free-form text column). Legacy
 * string values are still readable via {@link parseCharacterMemory}.
 */
export interface CharacterSheet {
  /** Stable id within the cast roster. */
  slug: string;
  name: string;
  role?: string;
  /** Where the character is right now (latest known). */
  location?: string;
  /** "in scene" = physically present in the current scene. */
  inScene?: boolean;
  /** alive | dead | departed | unknown. */
  status?: "alive" | "dead" | "departed" | "unknown";
  /** Other characters with a named relationship. */
  relationships?: { slug: string; type: string }[];
  /** Items the character is currently carrying or associated with. */
  inventory?: string[];
  /** Facts this character knows. */
  knownFacts?: string[];
  /** Current disposition / attitude. */
  attitude?: string;
  /** Short summary of last meaningful interaction. */
  lastScene?: string;
  /** ISO timestamp of the last sync that produced this sheet. */
  lastUpdatedAt?: string;
  /** Confidence in [0..1] that the LLM had when producing this update. */
  confidence?: number;
}

type EnvelopeV1 = {
  v: 1;
  sheet: CharacterSheet;
};

type EnvelopeLegacy = {
  v: 0;
  rawText: string;
};

type Envelope = EnvelopeV1 | EnvelopeLegacy;

/**
 * Parse the `character_memory` column. Tries the v1 envelope first, then
 * accepts a bare string (legacy), then returns null. Never throws.
 */
export function parseCharacterMemory(
  raw: string | null | undefined,
): { sheet: CharacterSheet | null; rawText: string } {
  if (!raw) return { sheet: null, rawText: "" };
  const trimmed = raw.trim();
  if (!trimmed) return { sheet: null, rawText: "" };
  // Quick path: legacy plain-text memory (does not start with "{").
  if (!trimmed.startsWith("{")) {
    return { sheet: null, rawText: trimmed };
  }
  try {
    const parsed = JSON.parse(trimmed) as Envelope;
    if (parsed && typeof parsed === "object") {
      if (parsed.v === 1 && parsed.sheet && typeof parsed.sheet === "object") {
        return { sheet: parsed.sheet, rawText: "" };
      }
      if (parsed.v === 0 && typeof parsed.rawText === "string") {
        return { sheet: null, rawText: parsed.rawText };
      }
    }
  } catch {
    /* fall through */
  }
  // JSON-looking but invalid → treat as plain text.
  return { sheet: null, rawText: trimmed };
}

/** Serialize a sheet to the v1 envelope that we store in `character_memory`. */
export function serializeCharacterSheet(sheet: CharacterSheet): string {
  return JSON.stringify({ v: 1, sheet } satisfies EnvelopeV1);
}

/** Serialize a legacy free-form text memory. */
export function serializeCharacterLegacy(rawText: string): string {
  return JSON.stringify({ v: 0, rawText } satisfies EnvelopeLegacy);
}

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

  function formatCharacterBlock(c: CharacterRow): string {
    const { sheet, rawText } = parseCharacterMemory(c.character_memory);
    const out: string[] = [`**${c.name}** (\`${c.slug}\`)`];
    if (sheet) {
      const bits: string[] = [];
      if (sheet.role) bits.push(`role: ${sheet.role}`);
      if (sheet.location) bits.push(`**Location:** ${sheet.location}`);
      if (typeof sheet.inScene === "boolean") {
        bits.push(`**In scene:** ${sheet.inScene ? "yes" : "no"}`);
      }
      if (sheet.status && sheet.status !== "unknown") {
        bits.push(`status: ${sheet.status}`);
      }
      if (sheet.attitude) bits.push(`attitude: ${sheet.attitude}`);
      if (sheet.relationships?.length) {
        bits.push(
          `relationships: ${sheet.relationships.map((r) => `${r.slug} (${r.type})`).join(", ")}`,
        );
      }
      if (sheet.inventory?.length) {
        bits.push(`inventory: ${sheet.inventory.join(", ")}`);
      }
      if (sheet.knownFacts?.length) {
        bits.push(`knows: ${sheet.knownFacts.join("; ")}`);
      }
      if (sheet.lastScene) bits.push(`last scene: ${sheet.lastScene}`);
      if (bits.length) out.push(bits.join(" · "));
    }
    const text = (rawText || c.character_memory || "").trim();
    if (text && !sheet) {
      // Legacy free-form memory (no structured sheet yet).
      out.push(text);
    } else if (!text && !sheet) {
      out.push("(No memory yet.)");
    }
    return out.join("\n");
  }

  if (active.length) {
    lines.push("", "### Active in story");
    for (const c of active) {
      lines.push(formatCharacterBlock(c));
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
        const { sheet, rawText } = parseCharacterMemory(c.character_memory);
        if (sheet) {
          const bits: string[] = [];
          if (sheet.lastScene) bits.push(sheet.lastScene);
          if (bits.length) lines.push(bits.join(" · "));
        } else if (rawText) {
          lines.push(rawText);
        }
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
    .map((c) => {
      const { sheet } = parseCharacterMemory(c.character_memory);
      return {
        slug: c.slug,
        name: c.name,
        status: c.status ?? "active",
        sheet,
      };
    });

  const messages = [
    {
      role: "system",
      content: `You track CAST characters for an interactive RPG (not the player protagonist).

Return ONLY valid JSON:
{
  "characters": [
    {
      "slug": "snake_case",
      "name": "Display Name",
      "action": "create|update|archive",
      "sheet": {
        "role": "Schmuggler | Wache | Nichtsesshafte | …",
        "location": "Where they are right now (latest known)",
        "inScene": true|false,
        "status": "alive | dead | departed | unknown",
        "relationships": [{"slug": "other_slug", "type": "daughter | rival | employer | …"}],
        "inventory": ["item 1", "item 2"],
        "knownFacts": ["Fact this character knows", "Another fact"],
        "attitude": "Current disposition / mood toward the player",
        "lastScene": "One-sentence summary of last meaningful interaction",
        "confidence": 0.0 to 1.0
      },
      "archiveReason": "death | departure | left | unknown | null"
    }
  ]
}

Rules:
- Only named characters who matter in the story (not generic "guard" unless named).
- "create" = new character appearing for the first time (pick a new slug from name).
- "update" = existing character; refresh sheet from latest transcript.
- "archive" = died, left the story permanently, imprisoned long-term, or otherwise gone from the active story entirely.
- **Leaving the scene temporarily** (went home, agreed to meet later, walked away) = "update" with inScene=false and a real location — do NOT archive unless they left the story for good.
- For archive: keep the last known sheet; status should be "dead" or "departed".
- Use existing slugs when the character is already in the roster.
- Do not archive the player protagonist.
- confidence: how sure are you about each field? Use 0.6+ for facts directly stated in the transcript, 0.3-0.6 for inferences, below 0.3 for guesses.
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
    maxTokens: 1600,
    temperature: 0.2,
  });

  const parsed = parseJsonFromModel(raw) as {
    characters?: Array<Partial<CharacterMemoryUpdate> & { sheet?: CharacterSheet }>;
  } | null;

  if (!parsed?.characters?.length) return [];

  return parsed.characters
    .map((c) => normalizeUpdate(c, existingCast))
    .filter((c): c is CharacterMemoryUpdate => c !== null);
}

function normalizeUpdate(
  raw: Partial<CharacterMemoryUpdate> & { sheet?: CharacterSheet },
  existingCast: CharacterRow[],
): CharacterMemoryUpdate | null {
  const name = raw.name?.trim();
  if (!name) return null;
  const providedMemory = raw.memory?.trim();
  const sheet = normalizeSheet(raw.sheet, name);
  if (!sheet && !providedMemory) return null;

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

  const finalSheet: CharacterSheet | undefined = sheet
    ? { ...sheet, slug, name: match?.name ?? name, lastUpdatedAt: new Date().toISOString() }
    : undefined;

  // Prefer a structured sheet; fall back to whatever text the LLM supplied.
  const memory =
    finalSheet
      ? serializeCharacterSheet(finalSheet)
      : (providedMemory ?? "");

  return {
    slug,
    name: match?.name ?? name,
    action,
    sheet: finalSheet,
    memory,
    archiveReason:
      typeof raw.archiveReason === "string" ? raw.archiveReason : null,
  };
}

function normalizeSheet(
  raw: CharacterSheet | undefined,
  fallbackName: string,
): CharacterSheet | null {
  if (!raw || typeof raw !== "object") return null;
  const slug =
    (typeof raw.slug === "string" && raw.slug.trim().toLowerCase().replace(/_/g, "-")) ||
    slugifyCharacterName(fallbackName);
  if (!slug) return null;
  const name = (raw.name?.trim()) || fallbackName;
  const sheet: CharacterSheet = { slug, name };
  if (typeof raw.role === "string" && raw.role.trim()) sheet.role = raw.role.trim();
  if (typeof raw.location === "string" && raw.location.trim()) sheet.location = raw.location.trim();
  if (typeof raw.inScene === "boolean") sheet.inScene = raw.inScene;
  if (typeof raw.status === "string") {
    const s = raw.status.toLowerCase();
    if (s === "alive" || s === "dead" || s === "departed" || s === "unknown") {
      sheet.status = s;
    }
  }
  if (Array.isArray(raw.relationships)) {
    sheet.relationships = raw.relationships
      .filter((r) => r && typeof r === "object")
      .map((r) => ({
        slug: String((r as { slug?: unknown }).slug ?? "").trim(),
        type: String((r as { type?: unknown }).type ?? "").trim(),
      }))
      .filter((r) => r.slug && r.type);
  }
  if (Array.isArray(raw.inventory)) {
    sheet.inventory = raw.inventory
      .map((i) => String(i ?? "").trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw.knownFacts)) {
    sheet.knownFacts = raw.knownFacts
      .map((f) => String(f ?? "").trim())
      .filter(Boolean);
  }
  if (typeof raw.attitude === "string" && raw.attitude.trim()) sheet.attitude = raw.attitude.trim();
  if (typeof raw.lastScene === "string" && raw.lastScene.trim()) sheet.lastScene = raw.lastScene.trim();
  if (typeof raw.confidence === "number" && Number.isFinite(raw.confidence)) {
    sheet.confidence = Math.max(0, Math.min(1, raw.confidence));
  }
  return sheet;
}

export function minimalCharacterCard(name: string): StoryCharacterCard {
  return {
    name,
    description: "Character discovered during play.",
    personality: "",
  };
}

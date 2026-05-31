import { createClient } from "@/lib/supabase/client";
import { getTurns, type TurnRow } from "@/lib/db/stories";
import { parsePlotState, type StoryPlotState } from "@/lib/memory/plotState";
import { slugifyCharacterName } from "@/lib/memory/characterMemory";
import type { ChatTurn } from "@/lib/types";

const SPEAKER_TAG =
  /<<\s*speaker\s*:\s*([a-z0-9][a-z0-9_:-]*)\s*>>/gi;

const ROLE_LABELS: Record<string, { de: string; en: string }> = {
  mother: { de: "Mutter", en: "Mother" },
  mutter: { de: "Mutter", en: "Mother" },
  mom: { de: "Mutter", en: "Mother" },
  mama: { de: "Mutter", en: "Mother" },
  father: { de: "Vater", en: "Father" },
  vater: { de: "Vater", en: "Father" },
  dad: { de: "Vater", en: "Father" },
  papa: { de: "Vater", en: "Father" },
  parents: { de: "Eltern", en: "Parents" },
  eltern: { de: "Eltern", en: "Parents" },
  sister: { de: "Schwester", en: "Sister" },
  schwester: { de: "Schwester", en: "Sister" },
  brother: { de: "Bruder", en: "Brother" },
  bruder: { de: "Bruder", en: "Brother" },
};

function formatTurn(t: {
  role: string;
  content: string;
  speaker_slug?: string | null;
}): string {
  if (t.role === "system") return "";
  const who =
    t.speaker_slug && t.speaker_slug !== "narrator"
      ? `${t.role} (${t.speaker_slug})`
      : t.role;
  return `${who}: ${t.content}`;
}

function isTaggedTurn(t: TurnRow): boolean {
  if (t.speaker_slug && t.speaker_slug !== "narrator") return true;
  resetSpeakerTagRegex();
  return SPEAKER_TAG.test(t.content);
}

function resetSpeakerTagRegex(): void {
  SPEAKER_TAG.lastIndex = 0;
}

export type SpeakerHint = {
  slug: string;
  castSlug: string;
  label: string;
  turnCount: number;
  chapters: string[];
  source: "speaker_slug" | "markup" | "relationship";
};

export type StoryScanBundle = {
  transcript: string;
  chapterDigests: string;
  speakerHints: SpeakerHint[];
  plotCharacters: string[];
  chapterTitles: string[];
};

export type StoryTranscriptBundle = {
  transcript: string;
  chapterTitles: string[];
};

export function slugToDisplayName(slug: string, locale: "de" | "en"): string {
  const raw = slug.replace(/^(npc|guest):/, "");
  const role = ROLE_LABELS[raw.toLowerCase()];
  if (role) return role[locale];
  return raw
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function normalizeCastSlug(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/_/g, "-");
  return s.replace(/^(npc|guest):/, "");
}

function compressChapterTurns(
  chapterTitle: string,
  summary: string | null,
  turns: TurnRow[],
  maxChars: number,
): string {
  const parts: string[] = [`## ${chapterTitle}`];
  if (summary?.trim()) {
    parts.push(`*(Kapitel-Memory)* ${summary.trim()}`);
  }

  const tagged: string[] = [];
  const other: string[] = [];
  for (const t of turns) {
    if (t.role === "system") continue;
    const line = formatTurn(t);
    if (!line) continue;
    resetSpeakerTagRegex();
    if (isTaggedTurn(t)) tagged.push(line);
    else other.push(line);
  }

  const body: string[] = [];
  let budget = maxChars;

  for (const line of tagged) {
    if (budget <= 0) break;
    body.push(line);
    budget -= line.length + 2;
  }

  if (budget > 0 && other.length) {
    const head = other.slice(0, 8);
    for (const line of head) {
      if (budget <= 0) break;
      body.push(line);
      budget -= line.length + 2;
    }
    if (other.length > head.length && budget > 400) {
      body.push("[…]");
      for (const line of other.slice(-6)) {
        if (budget <= 0) break;
        body.push(line);
        budget -= line.length + 2;
      }
    }
  }

  if (body.length) parts.push(body.join("\n\n"));
  return parts.join("\n\n");
}

function collectSlugsFromText(content: string): string[] {
  const slugs: string[] = [];
  resetSpeakerTagRegex();
  for (const m of content.matchAll(SPEAKER_TAG)) {
    slugs.push(m[1]!.toLowerCase());
  }
  return slugs;
}

function relationshipPatterns(locale: "de" | "en"): RegExp[] {
  if (locale === "en") {
    return [
      /\b(?:your|their|his|her)\s+(mother|father|parents|mom|dad)\b/gi,
      /\b(mother|father|mom|dad)\s+(?:says|said|asks|asked|whispers|whispered|calls|called|adds|added|repeats|mutters|shouts)\b/gi,
      /\b(?:mother's|father's)\s+voice\b/gi,
    ];
  }
  return [
    /\b(?:deine|deiner|eure|ihre|seine)\s+(Mutter|Vater|Eltern|Mama|Papa)\b/gi,
    /\b(Mutter|Vater|Mama|Papa|Eltern)\s+(?:sagt|sagte|fragt|fragte|ruft|rief|flüstert|flüsterte|wiederholt|murmelte|schreit)\b/gi,
    /\b(?:Mutter|Vater)(?:s)?\s+Stimme\b/gi,
  ];
}

function mineRelationshipHints(
  text: string,
  chapterTitle: string,
  locale: "de" | "en",
  acc: Map<string, SpeakerHint>,
): void {
  for (const re of relationshipPatterns(locale)) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const token = (m[1] ?? m[0]).toLowerCase();
      let key = token;
      if (/mutter|mother|mom|mama/.test(token)) key = "mother";
      else if (/vater|father|dad|papa/.test(token)) key = "father";
      else if (/eltern|parents/.test(token)) key = "parents";

      if (key === "parents") {
        for (const split of ["mother", "father"] as const) {
          addHint(acc, `npc:${split}`, chapterTitle, locale, "relationship");
        }
        continue;
      }
      addHint(acc, `npc:${key}`, chapterTitle, locale, "relationship");
    }
  }
}

function addHint(
  acc: Map<string, SpeakerHint>,
  slug: string,
  chapterTitle: string,
  locale: "de" | "en",
  source: SpeakerHint["source"],
): void {
  const normalized = slug.toLowerCase();
  if (normalized === "narrator") return;
  const castSlug = normalizeCastSlug(normalized);
  const existing = acc.get(castSlug);
  if (existing) {
    existing.turnCount += 1;
    if (!existing.chapters.includes(chapterTitle)) {
      existing.chapters.push(chapterTitle);
    }
    return;
  }
  acc.set(castSlug, {
    slug: normalized,
    castSlug,
    label: slugToDisplayName(normalized, locale),
    turnCount: 1,
    chapters: [chapterTitle],
    source,
  });
}

export function mineSpeakerHints(
  chapters: Array<{ title: string; turns: TurnRow[] }>,
  locale: "de" | "en",
): SpeakerHint[] {
  const acc = new Map<string, SpeakerHint>();

  for (const { title, turns } of chapters) {
    for (const t of turns) {
      if (t.role === "system") continue;

      if (t.speaker_slug && t.speaker_slug !== "narrator") {
        addHint(acc, t.speaker_slug, title, locale, "speaker_slug");
      }

      for (const slug of collectSlugsFromText(t.content)) {
        if (slug !== "narrator") {
          addHint(acc, slug, title, locale, "markup");
        }
      }

      mineRelationshipHints(t.content, title, locale, acc);
    }
  }

  return [...acc.values()].sort((a, b) => b.turnCount - a.turnCount);
}

export function collectPlotCharacterNames(
  plotState: StoryPlotState | null | undefined,
): string[] {
  if (!plotState) return [];
  const names = new Set<string>();
  for (const n of plotState.presentCharacters ?? []) {
    const t = n?.trim();
    if (t) names.add(t);
  }
  for (const a of plotState.absentCharacters ?? []) {
    const t = a.name?.trim();
    if (t) names.add(t);
  }
  for (const ev of plotState.scheduledEvents ?? []) {
    for (const p of ev.participants ?? []) {
      const t = p?.trim();
      if (t) names.add(t);
    }
  }
  return [...names];
}

export async function loadStoryScanContext(
  storyId: string,
  locale: "de" | "en" = "de",
  plotStateRaw?: unknown,
): Promise<StoryScanBundle> {
  const supabase = createClient();

  const { data: bands, error: bandErr } = await supabase
    .from("bands")
    .select("id, title, index_in_story")
    .eq("story_id", storyId)
    .order("index_in_story", { ascending: true });
  if (bandErr) throw bandErr;

  const chapterTitles: string[] = [];
  const chapterBlocks: string[] = [];
  const chapterData: Array<{ title: string; turns: TurnRow[] }> = [];

  for (const band of bands ?? []) {
    const { data: chapters, error: chErr } = await supabase
      .from("chapters")
      .select(
        "id, title, index_in_band, chapter_summary, rolling_summary",
      )
      .eq("band_id", band.id)
      .order("index_in_band", { ascending: true });
    if (chErr) throw chErr;

    const bandLabel =
      (band.title as string | null)?.trim() ||
      `Band ${band.index_in_story as number}`;

    for (const ch of chapters ?? []) {
      const title =
        (ch.title as string | null)?.trim() ||
        ((bands?.length ?? 0) > 1
          ? `${bandLabel} · Kapitel ${ch.index_in_band}`
          : `Kapitel ${ch.index_in_band}`);
      chapterTitles.push(title);

      const turns = await getTurns(ch.id as string);
      chapterData.push({ title, turns });

      const summary =
        (ch.rolling_summary as string | null)?.trim() ||
        (ch.chapter_summary as string | null)?.trim() ||
        null;

      if (turns.length || summary) {
        chapterBlocks.push(
          compressChapterTurns(title, summary, turns, 4500),
        );
      }
    }
  }

  const speakerHints = mineSpeakerHints(chapterData, locale);
  const plotCharacters = collectPlotCharacterNames(
    parsePlotState(plotStateRaw),
  );

  let chapterDigests = chapterBlocks.join("\n\n");
  let transcript = chapterDigests;

  const maxTotal = 72000;
  if (transcript.length > maxTotal) {
    const summaryOnly = chapterBlocks
      .map((block) => {
        const lines = block.split("\n");
        const head = lines.slice(0, 3).join("\n");
        const tagged = lines.filter(
          (l) =>
            /<<\s*speaker\s*:/i.test(l) ||
            /\((npc:|guest:|cast)/i.test(l),
        );
        return [head, ...tagged.slice(0, 12)].join("\n");
      })
      .join("\n\n");
    transcript = `[Volltext gekürzt — alle Kapitel-Summaries + markierte Dialoge]\n\n${summaryOnly}`;
    if (transcript.length > maxTotal) {
      transcript = transcript.slice(0, maxTotal);
    }
  }

  return {
    transcript,
    chapterDigests,
    speakerHints,
    plotCharacters,
    chapterTitles,
  };
}

/** @deprecated Prefer loadStoryScanContext */
export async function loadStoryTranscript(
  storyId: string,
  maxChars = 48000,
): Promise<StoryTranscriptBundle> {
  const scan = await loadStoryScanContext(storyId);
  let transcript = scan.transcript;
  if (transcript.length > maxChars) {
    transcript = transcript.slice(-maxChars);
  }
  return { transcript, chapterTitles: scan.chapterTitles };
}

export function isThinCharacterCard(description?: string | null): boolean {
  const d = description?.trim() ?? "";
  return (
    !d ||
    d === "Character discovered during play." ||
    d.length < 24
  );
}

export function plotStateSummary(plotState: unknown): string | null {
  if (!plotState || typeof plotState !== "object") return null;
  try {
    return JSON.stringify(plotState, null, 2).slice(0, 6000);
  } catch {
    return null;
  }
}

export function formatSpeakerHintsForPrompt(hints: SpeakerHint[]): string {
  if (!hints.length) return "";
  return hints
    .slice(0, 24)
    .map(
      (h) =>
        `- ${h.label} (slug: ${h.castSlug}, ${h.turnCount}× in: ${h.chapters.slice(0, 4).join(", ")}${h.chapters.length > 4 ? "…" : ""}, Quelle: ${h.source})`,
    )
    .join("\n");
}

export function turnsToChat(
  turns: Array<{ role: string; content: string; speaker_slug?: string | null }>,
): ChatTurn[] {
  return turns.map((t) => ({
    role: t.role as ChatTurn["role"],
    content: t.content,
    speakerSlug: t.speaker_slug ?? undefined,
  }));
}

export function hintToCandidate(
  hint: SpeakerHint,
  locale: "de" | "en",
): {
  slug: string;
  name: string;
  summary: string;
  suggestedMemory: string;
  kind: "new";
} {
  const chapterList = hint.chapters.slice(0, 5).join(", ");
  const freq =
    locale === "de"
      ? `Taucht wiederholt in der Story auf (${hint.turnCount}× erkannt`
      : `Recurring in the story (${hint.turnCount}× detected`;
  return {
    slug: hint.castSlug || slugifyCharacterName(hint.label),
    name: hint.label,
    summary:
      locale === "de"
        ? `${hint.label} — ${freq}, u. a. ${chapterList}).`
        : `${hint.label} — ${freq}, e.g. ${chapterList}).`,
    suggestedMemory:
      locale === "de"
        ? `${hint.label} ist eine wiederkehrende Figur. Zuletzt aktiv in: ${chapterList}.`
        : `${hint.label} is a recurring character. Recently active in: ${chapterList}.`,
    kind: "new",
  };
}

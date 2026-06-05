import { appendLightContinuationHint } from "@/lib/chat/continuationSeam";
import { defaultContinuePrompt } from "@/lib/chat/storyBeatSuggestions";
import {
  parseSpeakerBlocks,
  preprocessAssistantMarkup,
  stripSpeakerTags,
} from "@/lib/chat/parseSpeakerBlocks";
import { stripGameMetaLeaks } from "@/lib/chat/sanitizeAssistantOutput";
import {
  PROTAGONIST_SPEAKER_SLUG,
  type StoryContentLocale,
} from "@/lib/story/protagonist";
import type { ChatTurn } from "@/lib/types";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";

export type QuickReactionId = "laugh" | "cry" | "smile";

export type SteeringInputMode = "auto" | "say" | "act";

/** Prefix on persisted user turns created from steering (stripped in UI). */
export const STEERING_TURN_PREFIX = "↪ ";

const REACTION_LABELS_DE: Record<QuickReactionId, string> = {
  laugh: "😂 Lachen",
  cry: "😢 Weinen",
  smile: "😊 Lächeln",
};

const REACTION_LABELS_EN: Record<QuickReactionId, string> = {
  laugh: "😂 Laugh",
  cry: "😢 Cry",
  smile: "😊 Smile",
};

const REACTION_PROMPTS_EN: Record<QuickReactionId, string> = {
  laugh:
    "[Steering: The player message above is the intended beat. The protagonist laughs in the current situation. Continue the scene naturally; brief reactions from others if fitting. Do not repeat prior text. End at a natural pause.]",
  cry:
    "[Steering: The player message above is the intended beat. The protagonist is moved to tears (or fights them back) in the current situation. Continue the scene with emotional weight. Do not repeat prior text. End at a natural pause.]",
  smile:
    "[Steering: The player message above is the intended beat. The protagonist smiles in the current situation. Continue the scene naturally. Do not repeat prior text. End at a natural pause.]",
};

const REACTION_PROMPTS_DE: Record<QuickReactionId, string> = {
  laugh:
    "[Steuerung: Die Spieler-Nachricht oben ist die gewünschte Richtung. Der Protagonist lacht in der aktuellen Situation. Szene natürlich fortsetzen; kurze Reaktionen anderer, wenn passend. Nichts wiederholen. Natürliche Pause am Ende.]",
  cry:
    "[Steuerung: Die Spieler-Nachricht oben ist die gewünschte Richtung. Der Protagonist ist bewegt bis zu Tränen (oder unterdrückt sie) in der aktuellen Situation. Szene mit emotionaler Tiefe fortsetzen. Nichts wiederholen. Natürliche Pause am Ende.]",
  smile:
    "[Steuerung: Die Spieler-Nachricht oben ist die gewünschte Richtung. Der Protagonist lächelt in der aktuellen Situation. Szene natürlich fortsetzen. Nichts wiederholen. Natürliche Pause am Ende.]",
};

export function buildReactionSteeringPrompt(
  reaction: QuickReactionId,
  storyLocale?: string | null,
): string {
  const locale = normalizeStoryLocale(storyLocale);
  return locale === "de"
    ? REACTION_PROMPTS_DE[reaction]
    : REACTION_PROMPTS_EN[reaction];
}

export type SteeringDisplayKind =
  | "dialogue"
  | "reaction"
  | "direction"
  | "mixed";

export type SteeringSegment =
  | { kind: "dialogue"; text: string }
  | { kind: "action"; text: string };

export type ParsedSteeringInput = {
  segments: SteeringSegment[];
  display: string;
  dialogueLines: string[];
};

const ALL_REACTION_LABELS = [
  ...Object.values(REACTION_LABELS_DE),
  ...Object.values(REACTION_LABELS_EN),
];

type QuoteSpan = { start: number; end: number; inner: string };

function quotePatternsForLocale(locale: StoryContentLocale): RegExp[] {
  if (locale === "de") {
    return [
      /„([^„\n]{1,260}?)[\u201C\u201D"]/g,
      /[""]([^"""\n]{1,260})["""]/g,
    ];
  }
  return [
    /"([^"\n]{1,260})"/g,
    /'([^'\n]{1,260})'/g,
    /„([^„\n]{1,260}?)[\u201C\u201D"]/g,
  ];
}

function findQuotedSpans(
  text: string,
  locale: StoryContentLocale,
): QuoteSpan[] {
  const spans: QuoteSpan[] = [];
  for (const re of quotePatternsForLocale(locale)) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      if (m.index == null) continue;
      const inner = (m[1] ?? "").trim();
      if (!inner) continue;
      spans.push({
        start: m.index,
        end: m.index + m[0].length,
        inner,
      });
    }
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: QuoteSpan[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start < cursor) continue;
    out.push(s);
    cursor = s.end;
  }
  return out;
}

function normalizeActionSegment(raw: string): string {
  return raw.trim().replace(/^⚡\s*/, "").replace(/\s+/g, " ").trim();
}

function splitSteeringSegments(
  text: string,
  locale: StoryContentLocale,
): SteeringSegment[] {
  const spans = findQuotedSpans(text, locale);
  if (!spans.length) return [];

  const segments: SteeringSegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    const prose = normalizeActionSegment(text.slice(cursor, span.start));
    if (prose) segments.push({ kind: "action", text: prose });
    segments.push({ kind: "dialogue", text: span.inner });
    cursor = span.end;
  }
  const tail = normalizeActionSegment(text.slice(cursor));
  if (tail) segments.push({ kind: "action", text: tail });
  return segments;
}

function formatSegmentForDisplay(
  segment: SteeringSegment,
  locale: StoryContentLocale,
): string {
  if (segment.kind === "dialogue") {
    return locale === "de"
      ? `„${segment.text}"`
      : `"${segment.text}"`;
  }
  return `⚡ ${segment.text}`;
}

export function formatSteeringDisplayFromSegments(
  segments: SteeringSegment[],
  locale: StoryContentLocale,
): string {
  return segments.map((s) => formatSegmentForDisplay(s, locale)).join(" · ");
}

/** Parse free-form steering: action + dialogue in any order (quotes = spoken line). */
export function parseSteeringInput(
  raw: string,
  mode: SteeringInputMode = "auto",
  storyLocale?: string | null,
): ParsedSteeringInput | null {
  const text = raw.trim();
  if (!text) return null;

  const locale = normalizeStoryLocale(storyLocale) as StoryContentLocale;
  let segments = splitSteeringSegments(text, locale);

  if (!segments.length) {
    if (mode === "say") {
      const line = normalizeSteeringDialogueInput(text);
      if (!line) return null;
      segments = [{ kind: "dialogue", text: line }];
    } else {
      const action = normalizeActionSegment(text);
      if (!action) return null;
      segments = [{ kind: "action", text: action }];
    }
  }

  const display = formatSteeringDisplayFromSegments(segments, locale);
  const dialogueLines = segments
    .filter((s): s is SteeringSegment & { kind: "dialogue" } => s.kind === "dialogue")
    .map((s) => s.text);

  return { segments, display, dialogueLines };
}

export function classifySteeringDisplay(display: string): SteeringDisplayKind {
  const t = display.trim();
  if (ALL_REACTION_LABELS.includes(t)) return "reaction";

  const locale: StoryContentLocale = /„/.test(t) ? "de" : "en";
  const segments = splitSteeringSegments(t, locale);
  if (!segments.length) {
    if (t.startsWith("⚡")) return "direction";
    if (
      /^[\u201e\u201c"]/.test(t) ||
      (t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("„") && /[\u201c\u201d"]$/.test(t))
    ) {
      return "dialogue";
    }
    return "direction";
  }

  const hasDialogue = segments.some((s) => s.kind === "dialogue");
  const hasAction = segments.some((s) => s.kind === "action");
  if (hasDialogue && hasAction) return "mixed";
  if (hasDialogue) return "dialogue";
  return "direction";
}

const REACTION_IDS: QuickReactionId[] = ["laugh", "cry", "smile"];

function reactionIdFromDisplay(display: string): QuickReactionId | null {
  const t = display.trim();
  for (const id of REACTION_IDS) {
    if (t === REACTION_LABELS_DE[id] || t === REACTION_LABELS_EN[id]) return id;
  }
  return null;
}

export function buildDialogueSteeringPrompt(
  line: string,
  storyLocale?: string | null,
): string {
  const trimmed = line.trim();
  const locale = normalizeStoryLocale(storyLocale);
  if (locale === "de") {
    return `[Steuerung: Die Spieler-Nachricht direkt darüber ist die Dialogzeile. Der Protagonist sagt: „${trimmed}". Szene fließend fortsetzen — einmal einweben oder unter <<speaker:protagonist>>; nicht als lose Zitatzeile am Anfang wiederholen. Kein Szene-Reset. Natürliche Pause am Ende.]`;
  }
  return `[Steering: The player message directly above is the dialogue line. The protagonist says: "${trimmed}". Continue seamlessly — weave once in prose or under <<speaker:protagonist>>; do not repeat it as a standalone quoted line at the top. No scene reset. End at a natural pause.]`;
}

export function buildActionSteeringPrompt(
  action: string,
  storyLocale?: string | null,
): string {
  const trimmed = action.trim().replace(/^⚡\s*/, "");
  const locale = normalizeStoryLocale(storyLocale);
  if (locale === "de") {
    return `[Steuerung: Die Spieler-Nachricht direkt darüber ist die Handlung — ${trimmed}. In die laufende Szene einweben und geschehen lassen; fließend vom letzten Beat, nichts wiederholen. Natürliche Pause am Ende.]`;
  }
  return `[Steering: The player message directly above is the action — ${trimmed}. Weave it into the live scene; flow from the last beat, don't repeat prior text. End at a natural pause.]`;
}

export function buildMixedSteeringPrompt(
  segments: SteeringSegment[],
  storyLocale?: string | null,
): string {
  const locale = normalizeStoryLocale(storyLocale);
  const parts = segments.map((seg, i) => {
    const n = i + 1;
    if (seg.kind === "dialogue") {
      const q = locale === "de" ? `„${seg.text}"` : `"${seg.text}"`;
      return locale === "de"
        ? `(${n}) Dialog: ${q}`
        : `(${n}) dialogue: ${q}`;
    }
    return locale === "de"
      ? `(${n}) Handlung: ${seg.text}`
      : `(${n}) action: ${seg.text}`;
  });

  if (locale === "de") {
    return `[Steuerung: Die Spieler-Nachricht direkt darüber kombiniert Handlung und Dialog in dieser Reihenfolge: ${parts.join("; ")}. Alles fließend einweben — Dialog einmal (<<speaker:protagonist>> oder Prosodie), nicht als lose Zitatzeilen am Anfang wiederholen. Kein Szene-Reset. Natürliche Pause am Ende.]`;
  }
  return `[Steering: The player message directly above combines action and dialogue in this order: ${parts.join("; ")}. Weave everything into the live scene once — dialogue under <<speaker:protagonist>> or in prose, not as standalone quoted lines at the top. No scene reset. End at a natural pause.]`;
}

/** Light continuation hint appended after the steering bubble (keeps flow; bubble stays in history). */
export function buildSteeringContinuationPrompt(
  display: string,
  storyLocale?: string | null,
): string {
  const kind = classifySteeringDisplay(display);
  if (kind === "reaction") {
    const id = reactionIdFromDisplay(display);
    if (id) return buildReactionSteeringPrompt(id, storyLocale);
  }

  const locale = normalizeStoryLocale(storyLocale) as StoryContentLocale;
  const parsed = parseSteeringInput(display, "auto", locale);
  if (parsed && parsed.segments.length > 1) {
    return buildMixedSteeringPrompt(parsed.segments, storyLocale);
  }
  if (parsed?.segments.length === 1) {
    const seg = parsed.segments[0];
    if (seg.kind === "dialogue") {
      return buildDialogueSteeringPrompt(seg.text, storyLocale);
    }
    return buildActionSteeringPrompt(seg.text, storyLocale);
  }

  if (kind === "dialogue") {
    return buildDialogueSteeringPrompt(
      normalizeSteeringDialogueInput(display),
      storyLocale,
    );
  }
  return buildActionSteeringPrompt(display, storyLocale);
}

export function isSteeringUserTurn(content: string): boolean {
  return content.startsWith(STEERING_TURN_PREFIX);
}

export function stripSteeringTurnPrefix(content: string): string {
  return isSteeringUserTurn(content)
    ? content.slice(STEERING_TURN_PREFIX.length)
    : content;
}

export function formatSteeringUserTurnContent(
  display: string,
): string {
  return `${STEERING_TURN_PREFIX}${display.trim()}`;
}

export function formatSteeringReactionUserTurn(
  reaction: QuickReactionId,
  storyLocale?: string | null,
): string {
  const locale = normalizeStoryLocale(storyLocale);
  const label =
    locale === "de"
      ? REACTION_LABELS_DE[reaction]
      : REACTION_LABELS_EN[reaction];
  return formatSteeringUserTurnContent(label);
}

export function formatSteeringDialogueUserTurn(
  line: string,
  storyLocale?: string | null,
): string {
  const trimmed = line.trim();
  const locale = normalizeStoryLocale(storyLocale);
  const quoted =
    locale === "de" ? `„${trimmed}"` : `"${trimmed}"`;
  return formatSteeringUserTurnContent(quoted);
}

export function formatSteeringActionUserTurn(
  action: string,
  storyLocale?: string | null,
): string {
  void storyLocale;
  const t = action.trim().replace(/^⚡\s*/, "");
  const label = t.startsWith("⚡") ? t : `⚡ ${t}`;
  return formatSteeringUserTurnContent(label);
}

export function steeringInputPlaceholder(
  audiobookMode: boolean,
  locale: StoryContentLocale,
  inputMode: SteeringInputMode = "auto",
): string {
  if (!audiobookMode) {
    return locale === "de" ? "Was tust du?" : "What do you do?";
  }
  if (inputMode === "say") {
    return locale === "de" ? "Was sagst du? …" : "What do you say? …";
  }
  if (inputMode === "act") {
    return locale === "de"
      ? "Was tust du? z. B. zur Tür gehen …"
      : "What do you do? e.g. walk to the door …";
  }
  return locale === "de"
    ? 'Handlung und „Dialog" beliebig mischen — 💬/⚡ fügen Anführungszeichen oder ⚡ ein'
    : 'Mix action and "dialogue" freely — 💬/⚡ insert quotes or ⚡';
}


/** Empty dialogue field with cursor between opening and closing quote. */
export function emptyDialogueInput(locale: StoryContentLocale): {
  text: string;
  cursor: number;
} {
  if (locale === "de") {
    return { text: "„\"", cursor: 1 };
  }
  return { text: '""', cursor: 1 };
}

/** Build turn list for a continuation request (steering bubble stays; light hint appended). */
export function buildContinuationTurns(
  turns: ChatTurn[],
  continuationPrompt?: string,
  storyLocale?: string | null,
): ChatTurn[] {
  const fallback = continuationPrompt ?? defaultContinuePrompt();
  const last = turns[turns.length - 1];
  if (last?.role === "user" && isSteeringUserTurn(last.content)) {
    const display = stripSteeringTurnPrefix(last.content).trim();
    const prompt =
      continuationPrompt?.trim() ||
      buildSteeringContinuationPrompt(display, storyLocale);
    return [...turns, { role: "user", content: prompt }];
  }
  return [
    ...turns,
    {
      role: "user",
      content: appendLightContinuationHint(fallback, turns, storyLocale),
    },
  ];
}

export function normalizeSteeringDialogueInput(raw: string): string {
  let t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("„") && t.endsWith("\"")) ||
    (t.startsWith("„") && t.endsWith("“")) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeForQuoteCompare(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u2032`´']/g, "'")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripOuterQuotes(line: string): string {
  let t = line.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("„") && /[\u201C\u201D"]$/.test(t)) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function quoteOverlapRatio(a: string, b: string): number {
  const wordsB = b.split(" ").filter((w) => w.length > 2);
  if (!wordsB.length) return 0;
  const setA = new Set(a.split(" ").filter(Boolean));
  const hit = wordsB.filter((w) => setA.has(w)).length;
  return hit / wordsB.length;
}

function steeringQuoteMatchesLine(
  line: string,
  steeringCore: string,
): boolean {
  const core = normalizeForQuoteCompare(steeringCore);
  if (!core) return false;
  const candidate = normalizeForQuoteCompare(stripOuterQuotes(line));
  if (!candidate) return false;
  if (candidate === core) return true;
  if (candidate.includes(core) || core.includes(candidate)) return true;
  return quoteOverlapRatio(candidate, core) >= 0.82;
}

function dialogueAlreadyWoven(text: string, line: string): boolean {
  if (protagonistBlockContainsLine(text, line)) return true;
  const core = normalizeForQuoteCompare(line);
  if (core.length < 12) return false;
  const body = normalizeForQuoteCompare(stripSpeakerTags(text));
  if (body.includes(core)) return true;
  return quoteOverlapRatio(body, core) >= 0.72;
}

function protagonistBlockContainsLine(text: string, line: string): boolean {
  const needle = line.trim().toLowerCase();
  if (!needle) return false;
  for (const block of parseSpeakerBlocks(text)) {
    if (block.speakerSlug !== PROTAGONIST_SPEAKER_SLUG) continue;
    const body = stripSpeakerTags(block.content).toLowerCase();
    if (body.includes(needle)) return true;
  }
  return false;
}

/** Drop orphan quote-only lines the model pasted outside speaker tags. */
function removeOrphanDuplicateQuoteLines(
  text: string,
  line: string,
  storyLocale?: string | null,
): string {
  void storyLocale;
  const core = line.trim();
  if (!core) return text;
  const patterns = [
    new RegExp(`^„\\s*${escapeRegex(core)}\\s*["”]?$`, "i"),
    new RegExp(`^"\\s*${escapeRegex(core)}\\s*"$`, "i"),
    new RegExp(`^'\\s*${escapeRegex(core)}\\s*'$`, "i"),
    new RegExp(`^${escapeRegex(core)}\\s*\\??$`, "i"),
  ];
  return text
    .split("\n")
    .filter((row) => {
      const t = row.trim();
      if (!t) return true;
      if (patterns.some((re) => re.test(t))) return false;
      if (steeringQuoteMatchesLine(t, core)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Sanitize model output and ensure steering dialogue appears under <<speaker:protagonist>>.
 */
export function repairAssistantReplyForSteering(
  raw: string,
  steeringDisplay: string,
  storyLocale?: string | null,
  dialogueLines?: string[] | null,
): string {
  let text = stripGameMetaLeaks(preprocessAssistantMarkup(raw));
  const locale = normalizeStoryLocale(storyLocale);

  const lines =
    dialogueLines?.map((l) => l.trim()).filter(Boolean) ??
    parseSteeringInput(steeringDisplay, "auto", locale)?.dialogueLines ??
    [];

  if (!lines.length) {
    const kind = classifySteeringDisplay(steeringDisplay);
    if (kind !== "dialogue") return text;
    const single = normalizeSteeringDialogueInput(steeringDisplay);
    if (!single) return text;
    lines.push(single);
  }

  for (const line of lines) {
    text = removeOrphanDuplicateQuoteLines(text, line, storyLocale);
  }

  const missing = lines.filter(
    (line) =>
      !dialogueAlreadyWoven(text, line) &&
      !protagonistBlockContainsLine(text, line),
  );
  if (!missing.length) return text;

  const quoted = missing
    .map((line) => (locale === "de" ? `„${line}"` : `"${line}"`))
    .join("\n");
  const injection = `<<speaker:protagonist>>\n${quoted}\n\n`;
  return injection + text;
}

import { extractMarkedSnippets } from "@/lib/chat/dialogueQuotes";
import {
  genderedActionPattern,
  protagonistBeatBeforePattern,
  speechActPattern,
  speechVerbsPattern,
} from "@/lib/chat/dialogueLocale";
import { stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import { speakerDisplayName } from "@/lib/chat/speakerDisplay";
import type { CharacterRow } from "@/lib/db/stories";
import { slugifyCharacterName } from "@/lib/memory/characterMemory";
import {
  PROTAGONIST_SPEAKER_SLUG,
  type StoryContentLocale,
} from "@/lib/story/protagonist";

export { extractMarkedSnippets } from "@/lib/chat/dialogueQuotes";

export type DialogueSnippetAnalysis = {
  snippet: string;
  speakerSlug: string;
  displayName: string;
  inCast: boolean;
  reasons: string[];
};

type InferenceResult = {
  slug: string;
  reasons: string[];
};

type InferenceContext = {
  quoteStart: number;
  quoteEnd: number;
  lastNonNarratorSlug: string | null;
  previousQuoteEnd: number;
  locale: StoryContentLocale;
};

const REMOTE_DIALOGUE_CUES =
  /\b(on the other end|the other end|through the line|on the line|your phone|the phone|incoming call|switch(?:es|ed)? lines|making calls|voice comes through|comes through clear|line crackles|rustle of urgent|urgent preparation)\b/i;

/** Breaks phone/remote speaker continuity (new call, line switch, new voice). */
const CALL_BREAK_CUES =
  /\b(switch(?:es|ed)? lines|incoming call|the display shows|your phone buzz|buzzes with an incoming|mother's voice|father's voice|your mother|your father)\b/i;

/** Capitalized words that are narration verbs, not character names. */
const FALSE_NAME_WORDS = new Set([
  "breathing",
  "touching",
  "kneeling",
  "watching",
  "staring",
  "looking",
  "running",
  "walking",
  "sitting",
  "standing",
  "lying",
  "holding",
  "helping",
  "rescued",
  "exploring",
  "drinking",
  "cupping",
  "pressing",
  "knowing",
  "glancing",
  "smiling",
  "others",
  "behind",
  "around",
  "give",
  "then",
  "some",
  "many",
  "all",
]);

const GENERIC_HINTS = new Set([
  "hidden",
  "community",
  "refugee",
  "refugees",
  "people",
  "person",
  "family",
  "families",
  "group",
  "unknown",
  "character",
  "cast",
  "you",
  "your",
]);

export function inferSpeakerForSnippet(
  text: string,
  snippet: string,
  cast: CharacterRow[],
  locale: StoryContentLocale = "en",
): string {
  const ordered = inferSpeakersOrdered(text, [snippet], cast, locale);
  return ordered.get(snippet)?.slug ?? "narrator";
}

export function inferSpeakersOrdered(
  text: string,
  snippets: string[],
  cast: CharacterRow[],
  locale: StoryContentLocale = "en",
): Map<string, InferenceResult> {
  const out = new Map<string, InferenceResult>();
  let searchFrom = 0;
  let lastNonNarrator: string | null = null;
  let previousQuoteEnd = 0;

  for (const snippet of snippets) {
    const idx = text.indexOf(snippet, searchFrom);
    if (idx < 0) {
      out.set(snippet, { slug: "narrator", reasons: ["snippet_not_found"] });
      continue;
    }
    const bridgeFromPrev = text.slice(
      Math.max(0, previousQuoteEnd),
      idx,
    );
    if (CALL_BREAK_CUES.test(bridgeFromPrev)) {
      lastNonNarrator = null;
    }
    const result = inferSpeakerDetailed(text, snippet, cast, {
      quoteStart: idx,
      quoteEnd: idx + snippet.length,
      lastNonNarratorSlug: lastNonNarrator,
      previousQuoteEnd,
      locale,
    });
    out.set(snippet, result);
    searchFrom = idx + snippet.length;
    previousQuoteEnd = idx + snippet.length;
    if (result.slug !== "narrator") {
      lastNonNarrator = result.slug;
    }
  }
  return out;
}

export function formatDialogueInferenceDebug(
  markup: DialogueSnippetAnalysis[],
): string {
  if (!markup.length) return "dialogue_inference: (no quotes detected)";
  const lines = ["dialogue_inference:"];
  for (let i = 0; i < markup.length; i++) {
    const m = markup[i];
    const castFlag = m.inCast ? "in_cast" : "NOT_IN_CAST";
    lines.push(
      `  [${i + 1}] slug=${m.speakerSlug} | ${m.displayName} | ${castFlag}`,
    );
    lines.push(`      reasons: ${m.reasons.join(", ")}`);
    lines.push(
      `      snippet: ${m.snippet.replace(/\s+/g, " ").slice(0, 200)}`,
    );
  }
  return lines.join("\n");
}

export function displayNameForSpeakerSlug(
  slug: string,
  cast: CharacterRow[],
): string {
  if (slug.startsWith("guest:")) {
    const raw = slug.slice(6).replace(/-/g, " ");
    return raw
      .split(" ")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  }
  if (slug.startsWith("npc:")) {
    const raw = slug.slice(4);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return speakerDisplayName(slug, cast);
}

function inferSpeakerDetailed(
  text: string,
  snippet: string,
  cast: CharacterRow[],
  ctx: InferenceContext,
): InferenceResult {
  const { quoteStart, quoteEnd } = ctx;
  const pStart = paragraphStart(text, quoteStart);
  const pEnd = paragraphEnd(text, quoteStart);
  const beforeInPara = text.slice(pStart, quoteStart);
  const afterInPara = text.slice(quoteEnd, pEnd);
  const bridgeFromPrev = text.slice(
    Math.max(0, ctx.previousQuoteEnd),
    quoteStart,
  );

  const headingName = inferNameFromActionBeat(beforeInPara);
  if (headingName) {
    const resolved = resolveNameToSlug(headingName, cast);
    return {
      slug: resolved.slug,
      reasons: [
        "action_beat_before_quote",
        resolved.inCast ? "cast_match" : "guest_not_in_cast",
      ],
    };
  }

  const locale = ctx.locale;
  const pronounSpeaker = inferGenderedSpeakerBeforeQuote(
    beforeInPara,
    cast,
    locale,
  );
  if (pronounSpeaker) return pronounSpeaker;

  const genderedAction = inferGenderedActionBeforeQuote(
    beforeInPara,
    ctx.lastNonNarratorSlug,
    cast,
    locale,
  );
  if (genderedAction) return genderedAction;

  const approachingGuest = inferApproachingCharacterBeforeQuote(
    beforeInPara,
    locale,
  );
  if (approachingGuest) return approachingGuest;

  const speechAct = inferSpeechActSpeakerBeforeQuote(beforeInPara, cast, locale);
  if (speechAct) return speechAct;

  if (isProtagonistDialogue(snippet, locale)) {
    return { slug: PROTAGONIST_SPEAKER_SLUG, reasons: ["protagonist_dialogue"] };
  }

  if (isProtagonistAddressingSomeone(snippet, cast, locale)) {
    return {
      slug: PROTAGONIST_SPEAKER_SLUG,
      reasons: ["protagonist_vocative_address"],
    };
  }

  if (protagonistBeatBeforePattern(locale).test(beforeInPara.slice(-120))) {
    return {
      slug: PROTAGONIST_SPEAKER_SLUG,
      reasons: ["protagonist_beat_before_quote"],
    };
  }

  if (protagonistBeatBeforePattern(locale).test(afterInPara.slice(0, 100))) {
    return {
      slug: PROTAGONIST_SPEAKER_SLUG,
      reasons: ["protagonist_beat_after_quote"],
    };
  }

  const continuity = inferSameSpeakerContinuity(
    text,
    snippet,
    cast,
    ctx,
    bridgeFromPrev,
  );
  if (continuity) return continuity;

  const remote = inferRemoteDialogueContinuity(
    snippet,
    beforeInPara,
    bridgeFromPrev,
    ctx.lastNonNarratorSlug,
    cast,
    locale,
  );
  if (remote) return remote;

  const roleNear = inferFamilyRoleNearQuote(
    beforeInPara,
    afterInPara.slice(0, 150),
  );
  if (roleNear) {
    return { slug: roleNear, reasons: ["family_role_near_quote"] };
  }

  const afterName = inferNameAfterQuote(afterInPara, locale);
  if (afterName) {
    const resolved = resolveNameToSlug(afterName, cast);
    return {
      slug: resolved.slug,
      reasons: [
        "attribution_after_quote",
        resolved.inCast ? "cast_match" : "guest_not_in_cast",
      ],
    };
  }

  const explicit = inferCastByExplicitAttribution(
    `${beforeInPara}\n${afterInPara}`.toLowerCase(),
    cast,
    locale,
  );
  if (explicit) {
    return { slug: explicit, reasons: ["explicit_name_verb"] };
  }

  const nearest = inferCastByNearestMention(
    `${beforeInPara.slice(-120)}${afterInPara.slice(0, 80)}`.toLowerCase(),
    cast,
  );
  if (nearest) {
    return { slug: nearest, reasons: ["nearest_name_in_local_window"] };
  }

  return { slug: "narrator", reasons: ["fallback_narrator"] };
}

function inferRemoteDialogueContinuity(
  snippet: string,
  beforeInPara: string,
  bridgeFromPrev: string,
  lastSlug: string | null,
  cast: CharacterRow[],
  locale: StoryContentLocale,
): InferenceResult | null {
  if (!lastSlug || lastSlug === "narrator") return null;
  if (isProtagonistDialogue(snippet, locale)) return null;

  const bridge = bridgeFromPrev.trim();
  if (!bridge && !REMOTE_DIALOGUE_CUES.test(beforeInPara)) return null;

  const combined = `${bridge}\n${beforeInPara}`.slice(-500);
  if (!REMOTE_DIALOGUE_CUES.test(combined)) return null;
  if (CALL_BREAK_CUES.test(combined)) return null;

  if (inferNameFromActionBeat(beforeInPara)) return null;
  if (inferNameFromActionBeat(bridge)) return null;
  if (inferCastByExplicitAttribution(bridge.toLowerCase(), cast, locale)) {
    return null;
  }
  const newGuest = bridge.match(
    /\b([A-Z][a-z]{2,})\s+(?:said|asks|asked|replied|replies|whispers|calls)\b/,
  );
  if (newGuest?.[1] && !isFalseName(newGuest[1])) return null;

  return {
    slug: lastSlug,
    reasons: ["remote_dialogue_continuity"],
  };
}

function isProtagonistDialogue(
  snippet: string,
  locale: StoryContentLocale,
): boolean {
  const inner = snippet
    .replace(/^[„""“”'«»]|[""“”'«»]$/g, "")
    .trim();
  if (locale === "de") {
    if (/^(du|dich|dir)\b/i.test(inner)) return true;
    if (/^ich\b/i.test(inner)) return true;
    if (
      /^(ja|nein|okay|ok|gut|klar|vielleicht|sicher|danke|wahrscheinlich|genau)\b/i.test(
        inner,
      )
    ) {
      return true;
    }
    if (/^(hallo|hey)\b/i.test(inner)) return true;
    return false;
  }
  if (/^you\s+(mean|know|think|see|hear|remember|understand)\b/i.test(inner)) {
    return false;
  }
  // "You're late" — someone addressing the protagonist, not "you confirm" lines.
  if (/^you(?:'re|'ve|'ll|'d)\b/i.test(inner)) return false;
  if (/^you\b/i.test(inner)) return true;
  if (/^hi,?\s+(mom|dad|mother|father|ma|pa)\b/i.test(inner)) return true;
  if (/^(mom|dad|mother|father|ma|pa),?\s+/i.test(inner)) return true;
  if (
    /^(yeah|yep|no|nope|okay|ok|right|sure|depends|maybe|probably|thanks|all of them|then we)\b/i.test(
      inner,
    )
  ) {
    return true;
  }
  if (/^oh,?\s+so\s+I'm\b/i.test(inner)) return false;
  if (/^I thought\b/i.test(inner)) return false;
  if (/\bI'm\b/i.test(inner)) {
    if (
      /\b(proud of you|love you|worried about you|sorry[,!]?|glad you're|happy you're|terrified,? but)\b/i.test(
        inner,
      )
    ) {
      return false;
    }
    return true;
  }
  if (/\bI am\b/i.test(inner)) {
    if (/\bI am the Guardian\b/i.test(inner)) return true;
    if (/\bI am (?:fine|okay|ok|not|sorry|ready|here|still)\b/i.test(inner)) {
      return true;
    }
    // NPC: "I am Zarek of the Kevali"
    if (
      /\bI am [A-Z][a-z]+(?:\s+of|\s+from|\s+for|\s+with)\b/.test(inner) ||
      (/\bI am [A-Z][a-z]+\b/.test(inner) && !/\bI am the\b/i.test(inner))
    ) {
      return false;
    }
    return true;
  }
  if (/\b(I've|I'll|my |me,|me\.)\b/i.test(inner)) return true;
  return false;
}

/** "Marcus, I have to take this" — protagonist speaks to Marcus, not Marcus's line. */
function isProtagonistAddressingSomeone(
  snippet: string,
  cast: CharacterRow[],
  locale: StoryContentLocale,
): boolean {
  const inner = snippet
    .replace(/^[„""“”'«»]|[""“”'«»]$/g, "")
    .trim();
  if (locale === "de") {
    const voc = inner.match(/^([A-ZÄÖÜ][a-zäöüß]+),\s+(.+)$/);
    if (voc?.[2] && /\b(ich|muss|müssen|werde|will|lass)\b/i.test(voc[2])) {
      return true;
    }
  }
  const vocative = inner.match(/^([A-Z][a-z]+),\s+(.+)$/);
  if (!vocative?.[1] || !vocative[2]) return false;
  const name = vocative[1];
  const rest = vocative[2];
  if (isFalseName(name)) return false;

  if (/^(mom|dad|mother|father|ma|pa)\b/i.test(name)) return true;
  if (/^(hi|hello|hey)\b/i.test(rest)) return true;
  if (/\btrust me\b/i.test(rest)) return true;
  if (
    /\b(I have to|I need to|I must|I'll|I will|let me|we need|not a scratch)\b/i.test(
      rest,
    )
  ) {
    return true;
  }
  if (/\bI\b/.test(rest)) {
    const { slug } = resolveNameToSlug(name, cast);
    if (slug !== "narrator") return true;
  }
  return false;
}

function inferNameFromActionBeat(before: string): string | null {
  const trimmed = before.trim();
  if (!trimmed) return null;

  const patterns = [
    /([A-Z][a-z]{2,})'s voice\s+/i,
    /([A-Z][a-z]{2,})'s\s+(?:cheeks|hand|hands|eyes|voice|shoulders|smile)\b/i,
    /([A-Z][a-z]{2,})\s+(?:blinks|laughs|smiles|nods|shrug(?:s)?|studies|steps forward|offers|exhales|gestures|turns|watches|waits)\b/i,
    /([A-Z][a-z]{2,})\s+is\s+(?:studying|watching|looking|waiting)\b/i,
    /([A-Z][a-z]{2,})\s+said\b/i,
    /([A-Z][a-z]{2,})\s+asked\b/i,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m?.[1] && !isFalseName(m[1])) return m[1];
  }

  return null;
}

function isReservedName(name: string): boolean {
  return isFalseName(name);
}

function isFalseName(name: string): boolean {
  const n = name.toLowerCase();
  if (FALSE_NAME_WORDS.has(n)) return true;
  return (
    n === "you" ||
    n === "your" ||
    n === "the" ||
    n === "he" ||
    n === "she" ||
    n === "they" ||
    n === "it" ||
    n === "his" ||
    n === "her" ||
    n === "safe"
  );
}

function inferFamilyRoleNearQuote(before: string, after: string): string | null {
  const ctx = `${before} ${after}`.toLowerCase();
  const roleVoice = ctx.match(
    /\b(?:your|his|her)\s+(mother|father)('s)?\s+voice\b/,
  );
  if (roleVoice?.[1]) return `npc:${roleVoice[1]}`;
  const yourRole = ctx.match(/\byour\s+(mother|father|sister|brother)\b/);
  if (yourRole?.[1]) return `npc:${yourRole[1]}`;
  if (/\b(?:your\s+)?mother\s+repeats\b/.test(ctx)) return "npc:mother";
  if (/\b(?:your\s+)?father\s+adds\b/.test(ctx)) return "npc:father";
  const roleVerb = ctx.match(
    new RegExp(
      `\\b(mother|father|sister|brother|mutter|vater|schwester|bruder)\\s+(?:${speechVerbsPattern("en")})\\b`,
      "i",
    ),
  );
  if (roleVerb?.[1]) return `npc:${roleVerb[1]}`;
  return null;
}

function inferSpeechActSpeakerBeforeQuote(
  before: string,
  cast: CharacterRow[],
  locale: StoryContentLocale,
): InferenceResult | null {
  const tail = before.slice(-160);
  if (!speechActPattern(locale).test(tail)) {
    return null;
  }

  for (const c of cast.filter((row) => row.role === "cast")) {
    const hints = buildSpeakerHints(c);
    for (const h of hints) {
      if (h.length >= 3 && before.toLowerCase().includes(h)) {
        return {
          slug: c.slug,
          reasons: ["speech_act_with_named_character"],
        };
      }
    }
  }

  return null;
}

function inferGenderedActionBeforeQuote(
  before: string,
  lastSlug: string | null,
  cast: CharacterRow[],
  locale: StoryContentLocale,
): InferenceResult | null {
  const tail = before.slice(-240);
  if (!genderedActionPattern(locale).test(tail)) {
    return null;
  }

  const ctxLower = before.toLowerCase();
  for (const c of cast.filter((row) => row.role === "cast")) {
    const hints = buildSpeakerHints(c);
    for (const h of hints) {
      if (h.length >= 3 && ctxLower.includes(h)) {
        return {
          slug: c.slug,
          reasons: ["gendered_action_with_name_in_para"],
        };
      }
    }
  }

  if (lastSlug && lastSlug !== "narrator") {
    return {
      slug: lastSlug,
      reasons: ["gendered_action_continuity"],
    };
  }

  return null;
}

function inferGenderedSpeakerBeforeQuote(
  before: string,
  cast: CharacterRow[],
  locale: StoryContentLocale,
): InferenceResult | null {
  const tail = before.slice(-120);
  const verbs = speechVerbsPattern(locale);
  if (!new RegExp(`\\b(she|he|sie|er)\\s+(?:${verbs})\\b`, "i").test(tail)) {
    return null;
  }

  const ctx = before.toLowerCase();
  if (/\b(?:your\s+|deine[rsm]?\s+)?mother\b/.test(ctx) || /\bmutter\b/.test(ctx)) {
    return { slug: "npc:mother", reasons: ["pronoun_she_he_with_mother"] };
  }
  if (/\b(?:your\s+|deine[rsm]?\s+)?father\b/.test(ctx) || /\bvater\b/.test(ctx)) {
    return { slug: "npc:father", reasons: ["pronoun_she_he_with_father"] };
  }

  const woman = before.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+woman)\b/g,
  );
  if (woman?.length && /\bshe\b/i.test(tail)) {
    const label = woman[woman.length - 1] ?? "";
    const resolved = resolveNameToSlug(label, cast);
    return {
      slug: resolved.slug,
      reasons: [
        "pronoun_she_with_woman_np",
        resolved.inCast ? "cast_match" : "guest_not_in_cast",
      ],
    };
  }

  return null;
}

function inferApproachingCharacterBeforeQuote(
  before: string,
  locale: StoryContentLocale,
): InferenceResult | null {
  const approaches =
    locale === "de"
      ? /\b([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*\s+(?:Frau|Mann))\s+(?:kommt|nähert sich|tritt)\b/i
      : /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:woman|man))\s+approaches\b/i;
  const m = before.match(approaches);
  if (!m?.[1]) return null;
  const label = m[1].trim();
  return {
    slug: `guest:${slugifyCharacterName(label)}`,
    reasons: ["character_approaches_before_quote", "guest_not_in_cast"],
  };
}

function inferSameSpeakerContinuity(
  text: string,
  snippet: string,
  cast: CharacterRow[],
  ctx: InferenceContext,
  bridgeFromPrev: string,
): InferenceResult | null {
  const last = ctx.lastNonNarratorSlug;
  const locale = ctx.locale;
  if (!last || last === "narrator") return null;
  if (isProtagonistDialogue(snippet, locale)) return null;
  if (isProtagonistAddressingSomeone(snippet, cast, locale)) return null;
  if (CALL_BREAK_CUES.test(bridgeFromPrev)) return null;

  const inner = snippet.replace(/^["“”']|["“”']$/g, "").trim();
  const continuesSpeech =
    /^(that|and|but|or|so|yet|then|which|who|what|when|where|why|how|the|terrified)\b/i.test(
      inner,
    ) || /\b(but proud|not enough)\b/i.test(inner);

  const window = text.slice(
    Math.max(0, ctx.quoteStart - 320),
    ctx.quoteStart,
  );
  const prevInterrupted = /["“][^"”]{0,220}[—–-]\s*["”]?\s*$/.test(window);

  if (continuesSpeech && (prevInterrupted || inferFamilyRoleNearQuote(bridgeFromPrev, ""))) {
    return { slug: last, reasons: ["interrupted_speech_continuation"] };
  }

  const bridge = bridgeFromPrev.replace(/\s+/g, " ").trim();
  if (
    bridge.length > 0 &&
    bridge.length < 220 &&
    !inferCastByExplicitAttribution(bridge.toLowerCase(), cast, locale) &&
    inferFamilyRoleNearQuote(bridge, "") === last
  ) {
    return { slug: last, reasons: ["same_speaker_short_bridge"] };
  }

  return null;
}

function inferNameAfterQuote(
  after: string,
  locale: StoryContentLocale,
): string | null {
  const m = after
    .trim()
    .match(
      new RegExp(
        `^["”']?\\s*([A-ZÄÖÜ][a-zäöüß]{2,})\\s+(?:${speechVerbsPattern(locale)})\\b`,
        "i",
      ),
    );
  if (m?.[1] && !isFalseName(m[1])) return m[1];
  return null;
}

function resolveNameToSlug(
  name: string,
  cast: CharacterRow[],
): { slug: string; inCast: boolean } {
  const lower = name.toLowerCase();
  for (const c of cast.filter((x) => x.role === "cast")) {
    const hints = buildSpeakerHints(c);
    if (
      c.name.toLowerCase() === lower ||
      hints.some((h) => h === lower) ||
      c.name.toLowerCase().startsWith(lower)
    ) {
      return { slug: c.slug, inCast: true };
    }
  }
  return { slug: `guest:${slugifyCharacterName(name)}`, inCast: false };
}

function paragraphStart(text: string, index: number): number {
  const para = text.lastIndexOf("\n\n", index);
  return para < 0 ? 0 : para + 2;
}

function paragraphEnd(text: string, index: number): number {
  const para = text.indexOf("\n\n", index);
  return para < 0 ? text.length : para;
}

function inferCastByExplicitAttribution(
  local: string,
  cast: CharacterRow[],
  locale: StoryContentLocale,
): string | null {
  const verbs = speechVerbsPattern(locale);
  for (const c of cast.filter((x) => x.role === "cast")) {
    const hints = buildSpeakerHints(c).map(escapeRegex);
    if (!hints.length) continue;
    const hintAlt = hints.join("|");
    const nameThenVerb = new RegExp(
      `\\b(?:${hintAlt})\\b[^\\n,.!?]{0,28}\\b(?:${verbs})\\b`,
      "i",
    );
    const verbThenName = new RegExp(
      `\\b(?:${verbs})\\b[^\\n,.!?]{0,28}\\b(?:${hintAlt})\\b`,
      "i",
    );
    const quoteThenName = new RegExp(
      `["“][^"”\\n]{2,260}["”][^\\n]{0,36}\\b(?:${hintAlt})\\b`,
      "i",
    );
    const nameThenQuote = new RegExp(
      `\\b(?:${hintAlt})\\b[^\\n]{0,36}["“][^"”\\n]{2,260}["”]`,
      "i",
    );
    if (
      nameThenVerb.test(local) ||
      verbThenName.test(local) ||
      quoteThenName.test(local) ||
      nameThenQuote.test(local)
    ) {
      return c.slug;
    }
  }
  return null;
}

function inferCastByNearestMention(
  local: string,
  cast: CharacterRow[],
): string | null {
  let best: { slug: string; score: number } | null = null;
  for (const c of cast.filter((x) => x.role === "cast")) {
    const hints = buildSpeakerHints(c);
    for (const h of hints) {
      const i = local.lastIndexOf(h);
      if (i < 0) continue;
      const distanceToEnd = Math.max(0, local.length - (i + h.length));
      const score = 1000 - distanceToEnd + Math.min(h.length, 12);
      if (!best || score > best.score) best = { slug: c.slug, score };
    }
  }
  return best?.slug ?? null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSpeakerHints(c: CharacterRow): string[] {
  const raw = [
    c.name,
    c.slug,
    c.name.split(/\s+/)[0] ?? "",
    ...c.slug.split(/[-_]/g),
  ]
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length >= 3)
    .filter((h) => !GENERIC_HINTS.has(h));

  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of raw) {
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(h);
  }
  return out;
}

export function speakerLabelsForSlug(
  speakerSlug: string,
  cast: CharacterRow[],
): string[] {
  if (speakerSlug.startsWith("guest:")) {
    const name = displayNameForSpeakerSlug(speakerSlug, cast);
    return [name, name.split(/\s+/)[0] ?? name];
  }
  if (speakerSlug.startsWith("npc:")) {
    const role = speakerSlug.slice(4);
    const cap = role.charAt(0).toUpperCase() + role.slice(1);
    return [
      role,
      cap,
      `your ${role}`,
      `Your ${role}`,
      `his ${role}`,
      `her ${role}`,
    ];
  }
  const row = cast.find(
    (c) => c.slug.toLowerCase() === speakerSlug.toLowerCase(),
  );
  if (!row) return [speakerSlug.replace(/-/g, " ")];
  const first = row.name.split(/\s+/)[0] ?? "";
  const labels = [row.name, first, ...buildSpeakerHints(row)];
  const uniq = new Set<string>();
  for (const l of labels) {
    const t = l.trim();
    if (t.length >= 2) {
      uniq.add(t);
      uniq.add(t.charAt(0).toUpperCase() + t.slice(1));
    }
  }
  return Array.from(uniq);
}

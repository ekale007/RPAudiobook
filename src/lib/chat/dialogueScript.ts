import {
  extractMarkedSnippets,
  inferSpeakersOrdered,
  type DialogueSnippetAnalysis,
} from "@/lib/chat/dialogueSpeakerInference";
import type { CharacterRow } from "@/lib/db/stories";
import {
  displayNameForSpeakerSlug,
  formatDialogueInferenceDebug,
} from "@/lib/chat/dialogueSpeakerInference";
import type { SpeakerBlock } from "@/lib/chat/parseSpeakerBlocks";
import {
  assistantTurnProseText,
  hasSpeakerTags,
  parseSpeakerBlocks,
  preprocessAssistantMarkup,
  stripSpeakerTags,
} from "@/lib/chat/parseSpeakerBlocks";
import type { StoryContentLocale } from "@/lib/story/protagonist";
import { PROTAGONIST_SPEAKER_SLUG } from "@/lib/story/protagonist";

export { hasSpeakerTags as hasSpeakerScriptTags };

/** Ensure stored turns have script tags (wrap untagged legacy text in narrator). */
export function ensureSpeakerScript(content: string): string {
  const trimmed = preprocessAssistantMarkup(content).trim();
  if (!trimmed) return trimmed;
  if (hasSpeakerTags(trimmed)) return trimmed;
  return `<<speaker:narrator>>\n${trimmed}`;
}

/**
 * Map each quoted/thought snippet to a speaker slug.
 * Uses <<speaker:…>> blocks when present; otherwise heuristic inference.
 */
export function buildDialogueAttributionMap(
  rawContent: string,
  cast: CharacterRow[],
  llm?: Map<string, { slug: string; reasons: string[] }>,
  locale: StoryContentLocale = "en",
): Map<string, string> {
  const out = new Map<string, string>();
  const preprocessed = preprocessAssistantMarkup(rawContent);
  const text = assistantTurnProseText(rawContent);

  if (!hasSpeakerTags(preprocessed)) {
    const snippets = extractMarkedSnippets(text, locale);
    const inferred = inferSpeakersOrdered(text, snippets, cast, locale);
    for (const snippet of snippets) {
      const slug = inferred.get(snippet)?.slug ?? "narrator";
      if (slug !== "narrator") out.set(snippet, slug);
    }
    return out;
  }

  const blocks = parseSpeakerBlocks(preprocessed);
  const snippets = extractMarkedSnippets(text, locale);
  const inferred = inferSpeakersOrdered(text, snippets, cast, locale);

  for (const snippet of snippets) {
    const block = findBlockForSnippet(blocks, snippet, text);
    const scriptSlug = block?.speakerSlug ?? "narrator";
    const heuristic = inferred.get(snippet);

    if (
      scriptSlug === PROTAGONIST_SPEAKER_SLUG &&
      isStrongNonProtagonistInference(heuristic)
    ) {
      out.set(snippet, normalizeScriptSlug(heuristic!.slug, cast));
      continue;
    }

    if (scriptSlug === PROTAGONIST_SPEAKER_SLUG) {
      const hSlug = heuristic?.slug ?? "narrator";
      if (
        hSlug === PROTAGONIST_SPEAKER_SLUG ||
        hSlug === "narrator" ||
        heuristic?.reasons.includes("protagonist_dialogue") ||
        heuristic?.reasons.includes("protagonist_vocative_address") ||
        heuristic?.reasons.includes("protagonist_beat_before_quote") ||
        heuristic?.reasons.includes("protagonist_beat_after_quote")
      ) {
        out.set(snippet, PROTAGONIST_SPEAKER_SLUG);
      }
      continue;
    }

    if (scriptSlug !== "narrator") {
      out.set(snippet, normalizeScriptSlug(scriptSlug, cast));
      continue;
    }

    const refined = heuristic?.slug ?? "narrator";
    if (refined !== "narrator") {
      out.set(snippet, refined);
    }
  }

  if (llm?.size) {
    for (const snippet of snippets) {
      const block = findBlockForSnippet(blocks, snippet, text);
      const scriptSlug = block?.speakerSlug ?? "narrator";
      const llmEntry = llm.get(snippet);
      if (!llmEntry) continue;

      if (
        scriptSlug !== "narrator" &&
        scriptSlug !== PROTAGONIST_SPEAKER_SLUG
      ) {
        continue;
      }

      if (llmEntry.slug === "narrator") {
        if (scriptSlug !== PROTAGONIST_SPEAKER_SLUG) {
          out.delete(snippet);
        }
      } else {
        out.set(snippet, normalizeScriptSlug(llmEntry.slug, cast));
      }
    }
  }

  return out;
}

function findBlockForSnippet(
  blocks: SpeakerBlock[],
  snippet: string,
  fullText: string,
): SpeakerBlock | null {
  const idx = fullText.indexOf(snippet);
  if (idx < 0) {
    for (const block of blocks) {
      if (block.content.includes(snippet)) return block;
    }
    return null;
  }

  let searchFrom = 0;
  for (const block of blocks) {
    const start = fullText.indexOf(block.content, searchFrom);
    if (start < 0) continue;
    const end = start + block.content.length;
    if (idx >= start && idx + snippet.length <= end) return block;
    searchFrom = end;
  }

  for (const block of blocks) {
    if (block.content.includes(snippet)) return block;
  }
  return null;
}

function isStrongNonProtagonistInference(
  heuristic?: { slug: string; reasons: string[] },
): boolean {
  if (!heuristic) return false;
  if (
    heuristic.slug === "narrator" ||
    heuristic.slug === PROTAGONIST_SPEAKER_SLUG
  ) {
    return false;
  }
  const weakOnly = new Set([
    "fallback_narrator",
    "snippet_not_found",
    "remote_dialogue_continuity",
    "gendered_action_continuity",
    "same_speaker_short_bridge",
    "interrupted_speech_continuation",
  ]);
  return heuristic.reasons.some((r) => !weakOnly.has(r));
}

function normalizeScriptSlug(slug: string, cast: CharacterRow[]): string {
  const lower = slug.toLowerCase().trim();
  if (lower === "protagonist") return "protagonist";
  if (lower.startsWith("guest:") || lower.startsWith("npc:")) return lower;
  const hit = cast.find((c) => c.slug.toLowerCase() === lower);
  if (hit) return hit.slug;
  return `guest:${lower.replace(/^guest:/, "")}`;
}

export function analyzeDialogueAttribution(
  content: string,
  cast: CharacterRow[],
  llm?: Map<string, { slug: string; reasons: string[] }>,
  locale: StoryContentLocale = "en",
): DialogueSnippetAnalysis[] {
  const preprocessed = preprocessAssistantMarkup(content);
  const text = assistantTurnProseText(content);
  const snippets = extractMarkedSnippets(text, locale);
  const tagged = hasSpeakerTags(preprocessed);
  const attribution = buildDialogueAttributionMap(content, cast, llm, locale);
  const inferred = inferSpeakersOrdered(text, snippets, cast, locale);
  const blocks = tagged ? parseSpeakerBlocks(preprocessed) : [];

  return snippets.map((snippet) => {
    const block = tagged ? findBlockForSnippet(blocks, snippet, text) : null;
    const scriptSlug = block?.speakerSlug ?? "narrator";
    const heuristic = inferred.get(snippet);
    const llmEntry = llm?.get(snippet);
    const refinedSlug = attribution.get(snippet);
    const slug =
      refinedSlug ??
      (tagged ? "narrator" : (heuristic?.slug ?? "narrator"));

    let reasons: string[];
    const scriptOverride =
      scriptSlug === PROTAGONIST_SPEAKER_SLUG &&
      slug !== PROTAGONIST_SPEAKER_SLUG &&
      slug !== "narrator";
    if (llmEntry && (scriptSlug === "narrator" || scriptSlug === PROTAGONIST_SPEAKER_SLUG)) {
      reasons = [...llmEntry.reasons];
      if (slug !== "narrator") reasons.unshift("llm_override");
      else reasons.unshift("llm_narrator");
    } else if (!tagged) {
      reasons = heuristic?.reasons ?? ["fallback_narrator"];
    } else if (scriptOverride) {
      reasons = ["script_protagonist_refined", ...(heuristic?.reasons ?? [])];
    } else if (scriptSlug !== "narrator" && scriptSlug !== PROTAGONIST_SPEAKER_SLUG) {
      reasons = ["script_tag"];
    } else if (scriptSlug === PROTAGONIST_SPEAKER_SLUG && slug === PROTAGONIST_SPEAKER_SLUG) {
      reasons = ["script_protagonist_block", ...(heuristic?.reasons ?? [])];
    } else if (slug !== "narrator") {
      reasons = ["script_narrator_refined", ...(heuristic?.reasons ?? [])];
    } else {
      reasons = ["script_tag_narrator_block", ...(heuristic?.reasons ?? [])];
    }

    const inCast =
      slug === "narrator" ||
      cast.some((c) => c.slug.toLowerCase() === slug.toLowerCase());
    return {
      snippet,
      speakerSlug: slug,
      displayName: displayNameForSpeakerSlug(slug, cast),
      inCast,
      reasons,
    };
  });
}

export function formatScriptAttributionDebug(
  content: string,
  cast: CharacterRow[],
  llm?: Map<string, { slug: string; reasons: string[] }>,
  locale: StoryContentLocale = "en",
): string {
  const lines: string[] = [];
  const tagged = hasSpeakerTags(content);
  const source = llm?.size
    ? "llm_hybrid"
    : tagged
      ? "script_tags"
      : "heuristic_inference";
  lines.push(`dialogue_source: ${source}`);

  if (hasSpeakerTags(content)) {
    lines.push("script_blocks:");
    for (const block of parseSpeakerBlocks(content)) {
      const quoteCount = extractMarkedSnippets(block.content, locale).length;
      lines.push(
        `  - slug=${block.speakerSlug} | quotes=${quoteCount} | ${block.content.replace(/\s+/g, " ").slice(0, 80)}…`,
      );
    }
  }

  lines.push("");
  lines.push(
    formatDialogueInferenceDebug(
      analyzeDialogueAttribution(content, cast, llm, locale),
    ),
  );
  return lines.join("\n");
}

/** @deprecated Prefer analyzeDialogueAttribution */
export const analyzeDialogueInNarratorTurn = analyzeDialogueAttribution;

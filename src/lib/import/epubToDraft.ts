import {
  buildEpubExcerpt,
  type ParsedEpub,
} from "@/lib/import/epubParse";
import {
  generateStoryDraftFromBrief,
  storyDraftLangLine,
} from "@/lib/story/generateStoryDraft";
import type { StoryDraft } from "@/lib/story/generateStoryDraft";
import type { OpenRouterSettings } from "@/lib/types";

export type EpubAdaptationMode = "faithful" | "inspired" | "loose";

export type EpubImportInterview = {
  locale: "de" | "en";
  protagonistName: string;
  protagonistDescription: string;
  adaptation: EpubAdaptationMode;
  startChapterIndex: number;
  tone: string;
  castNotes: string;
  extraNotes?: string;
};

const ADAPTATION_HINTS: Record<EpubAdaptationMode, string> = {
  faithful:
    "Stay close to the book's plot, names, and tone — adapt prose to second-person interactive fiction.",
  inspired:
    "Use the book as a strong reference; same world and characters, some freedom in scenes.",
  loose:
    "Loose remix — keep core premise and mood, allow new branches for interactivity.",
};

export async function generateStoryDraftFromEpub(
  settings: OpenRouterSettings,
  parsed: ParsedEpub,
  interview: EpubImportInterview,
  signal?: AbortSignal,
): Promise<StoryDraft> {
  const startIdx = Math.max(
    0,
    Math.min(interview.startChapterIndex, parsed.chapters.length - 1),
  );
  const startChapter = parsed.chapters[startIdx];
  const excerpt = buildEpubExcerpt(parsed, {
    startChapterIndex: startIdx,
    maxChars: 28_000,
  });

  const userBrief = [
    `Source book title: ${parsed.title}`,
    parsed.creator ? `Author: ${parsed.creator}` : null,
    `Total chapters detected: ${parsed.chapters.length}`,
    `Start chapter: ${startChapter?.title ?? `Index ${startIdx}`}`,
    `Adaptation: ${interview.adaptation} — ${ADAPTATION_HINTS[interview.adaptation]}`,
    `Player protagonist name: ${interview.protagonistName.trim() || "(unnamed — infer from book)"}`,
    interview.protagonistDescription.trim()
      ? `Protagonist notes: ${interview.protagonistDescription.trim()}`
      : null,
    interview.tone.trim() ? `Tone: ${interview.tone.trim()}` : null,
    interview.castNotes.trim()
      ? `Cast focus (speaking roles): ${interview.castNotes.trim()}`
      : null,
    interview.extraNotes?.trim()
      ? `Extra notes: ${interview.extraNotes.trim()}`
      : null,
    `Language: ${storyDraftLangLine(interview.locale)}`,
    "",
    "Book excerpt from start chapter onward (reference only — do not paste verbatim into first_mes):",
    excerpt,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const systemExtra = [
    "SOURCE: User-provided EPUB (they confirm they have rights to use it).",
    "GOAL: Convert this book into an interactive second-person audiobook RPG story package.",
    "The narrator first_mes must open at the chosen start chapter moment, rewritten as immersive IF (You …), not a raw copy-paste from the excerpt.",
    "Cast cards should map to important speaking characters from the book excerpt and user cast notes.",
    "Lore entries should capture setting, factions, rules, and relationships evident in the excerpt.",
    `Default storyTitle to a playable adaptation title derived from "${parsed.title}" unless a better short title fits.`,
  ].join("\n");

  return generateStoryDraftFromBrief(
    settings,
    interview.locale,
    userBrief,
    systemExtra,
    signal,
  );
}

import {
  buildEpubAnalysisExcerpt,
  planEpubAnalysisRegions,
  type ParsedEpub,
} from "@/lib/import/epubParse";
import {
  generateStoryDraftFromBrief,
  storyDraftLangLine,
} from "@/lib/story/generateStoryDraft";
import type { StoryDraft } from "@/lib/story/generateStoryDraft";
import type { OpenRouterSettings } from "@/lib/types";

export type EpubAdaptationMode = "faithful" | "inspired" | "loose";

export type EpubPacing = "slow" | "balanced" | "fast" | "";

export type EpubImportInterview = {
  locale: "de" | "en";
  protagonistName: string;
  protagonistDescription: string;
  adaptation: EpubAdaptationMode;
  startChapterIndex: number;
  genre: string;
  tone: string;
  pacing: EpubPacing;
  playGoals: string;
  castNotes: string;
  antagonistNotes: string;
  worldFocus: string;
  scopeNotes: string;
  avoidSpoilers: string;
  extraNotes?: string;
};

const PACING_HINTS: Record<Exclude<EpubPacing, "">, string> = {
  slow: "Leisurely, atmospheric, room for reflection.",
  balanced: "Mix of scene depth and forward motion.",
  fast: "Snappy beats, high momentum, shorter scenes.",
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
  const regions = planEpubAnalysisRegions(parsed, startIdx);
  const excerpt = buildEpubAnalysisExcerpt(parsed, {
    startChapterIndex: startIdx,
    maxChars: 72_000,
  });

  const regionSummary = regions
    .map(
      (r) =>
        `${r.label}: Kap. ${r.chapterIndex + 1} „${parsed.chapters[r.chapterIndex]?.title ?? ""}"`,
    )
    .join("; ");

  const userBrief = [
    `Source book title: ${parsed.title}`,
    parsed.creator ? `Author: ${parsed.creator}` : null,
    `Total chapters detected: ${parsed.chapters.length}`,
    `Play start chapter: ${startChapter?.title ?? `Index ${startIdx}`} (index ${startIdx})`,
    `Analysis regions sampled: ${regionSummary}`,
    `Adaptation: ${interview.adaptation} — ${ADAPTATION_HINTS[interview.adaptation]}`,
    `Player protagonist name: ${interview.protagonistName.trim() || "(unnamed — infer from book)"}`,
    interview.protagonistDescription.trim()
      ? `Protagonist notes: ${interview.protagonistDescription.trim()}`
      : null,
    interview.playGoals.trim()
      ? `What the player wants to experience: ${interview.playGoals.trim()}`
      : null,
    interview.genre.trim() ? `Genre: ${interview.genre.trim()}` : null,
    interview.tone.trim() ? `Tone: ${interview.tone.trim()}` : null,
    interview.pacing
      ? `Pacing: ${interview.pacing} — ${PACING_HINTS[interview.pacing]}`
      : null,
    interview.castNotes.trim()
      ? `Cast focus (speaking roles): ${interview.castNotes.trim()}`
      : null,
    interview.antagonistNotes.trim()
      ? `Antagonists / factions: ${interview.antagonistNotes.trim()}`
      : null,
    interview.worldFocus.trim()
      ? `World & rules to emphasize: ${interview.worldFocus.trim()}`
      : null,
    interview.scopeNotes.trim()
      ? `Story scope (how much of the book): ${interview.scopeNotes.trim()}`
      : null,
    interview.avoidSpoilers.trim()
      ? `Spoilers to avoid in opening: ${interview.avoidSpoilers.trim()}`
      : null,
    interview.extraNotes?.trim()
      ? `Extra notes: ${interview.extraNotes.trim()}`
      : null,
    `Language: ${storyDraftLangLine(interview.locale)}`,
    "",
    "Book excerpts (multiple regions — reference only; do not paste verbatim into first_mes):",
    excerpt,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const systemExtra = [
    "SOURCE: User-provided EPUB (they confirm they have rights to use it).",
    "GOAL: Convert this book into an interactive second-person audiobook RPG story package.",
    "The narrator first_mes must open at the chosen start chapter moment, rewritten as immersive IF (You …), not a raw copy-paste from the excerpt.",
    "Cast cards should map to important speaking characters from ALL excerpt regions and user cast notes.",
    "Lore entries should capture setting, factions, rules, and relationships from opening, mid-book, and play-start excerpts.",
    "Respect scope and spoiler-avoidance notes — first_mes opens at play-start only.",
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

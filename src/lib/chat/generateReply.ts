import { buildChatMessages } from "@/lib/prompt/buildPrompt";
import { ensureSpeakerScript } from "@/lib/chat/dialogueScript";
import { preprocessAssistantMarkup } from "@/lib/chat/parseSpeakerBlocks";
import { completeOpenRouter } from "@/lib/llm/openrouter";
import { resolveChatModelSettings } from "@/lib/storage/openRouterSettings";
import type { OpenRouterSettings } from "@/lib/types";
import type { ChatTurn, LoreEntry, StorySettings, WryTourCharacter } from "@/lib/types";
import type { CharacterRow } from "@/lib/db/stories";
import type { StoryPlotState } from "@/lib/memory/plotState";
import { defaultContinuePrompt } from "@/lib/chat/storyBeatSuggestions";

export type GenerateReplyParams = {
  settings: OpenRouterSettings;
  character: WryTourCharacter;
  cast: CharacterRow[];
  loreEntries: LoreEntry[];
  turns: ChatTurn[];
  storySettings: StorySettings;
  bandSummary?: string | null;
  chapterSummary?: string | null;
  rollingSummary?: string | null;
  chapterTitle?: string | null;
  phaseHint?: string | null;
  chapterIndex?: number;
  closedChapterCount?: number;
  plotState?: StoryPlotState | null;
  allCast?: CharacterRow[];
  continuation?: boolean;
  /** Overrides default “continue” prompt (e.g. chosen story beat). */
  continuationPrompt?: string;
  onLoreCount?: (n: number) => void;
  signal?: AbortSignal;
};

/** Full reply in one request (no token streaming — simpler on mobile). */
export async function streamAssistantReply(
  params: GenerateReplyParams,
): Promise<string> {
  const history = params.continuation
    ? [
        ...params.turns,
        {
          role: "user" as const,
          content:
            params.continuationPrompt ?? defaultContinuePrompt(),
        },
      ]
    : params.turns;

  const promptCtx = {
    character: params.character,
    loreEntries: params.loreEntries,
    turns: history,
    bandSummary: params.bandSummary,
    chapterSummary: params.chapterSummary,
    rollingSummary: params.rollingSummary,
    chapterTitle: params.chapterTitle,
    phaseHint: params.phaseHint,
    chapterIndex: params.chapterIndex,
    closedChapterCount: params.closedChapterCount,
    plotState: params.plotState,
    allCast: params.allCast ?? params.cast,
    settings: params.storySettings,
  };

  const { messages, activeLoreCount } = buildChatMessages(promptCtx);
  params.onLoreCount?.(activeLoreCount);

  const chatSettings = resolveChatModelSettings(params.settings);
  return completeOpenRouter(chatSettings, messages, {
    maxTokens: chatSettings.maxTokens,
    temperature: chatSettings.temperature,
    signal: params.signal,
  });
}

/** Storyteller mode: one narrator turn per reply (content keeps script tags). */
export function parseAssistantBlocks(full: string): Array<{
  speakerSlug: string;
  content: string;
}> {
  const cleaned = ensureSpeakerScript(preprocessAssistantMarkup(full));
  return [{ speakerSlug: "narrator", content: cleaned }];
}

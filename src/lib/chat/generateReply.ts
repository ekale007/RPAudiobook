import { buildChatMessages } from "@/lib/prompt/buildPrompt";
import { buildGroupChatMessages } from "@/lib/prompt/buildGroupPrompt";
import { parseSpeakerBlocks } from "@/lib/chat/parseSpeakerBlocks";
import { streamOpenRouterChat } from "@/lib/llm/openrouter";
import type { OpenRouterSettings } from "@/lib/types";
import type {
  ChatMode,
  ChatTurn,
  LoreEntry,
  StorySettings,
  WryTourCharacter,
} from "@/lib/types";
import type { CharacterRow } from "@/lib/db/stories";

const CONTINUE_USER =
  "[Continue the story from here. Write the next moments in scene. Do not repeat prior text. End at a natural pause for the player.]";

export type GenerateReplyParams = {
  settings: OpenRouterSettings;
  chatMode: ChatMode;
  character: WryTourCharacter;
  cast: CharacterRow[];
  loreEntries: LoreEntry[];
  turns: ChatTurn[];
  storySettings: StorySettings;
  bandSummary?: string | null;
  chapterSummary?: string | null;
  rollingSummary?: string | null;
  continuation?: boolean;
  onToken?: (chunk: string) => void;
  onLoreCount?: (n: number) => void;
  signal?: AbortSignal;
};

export async function streamAssistantReply(
  params: GenerateReplyParams,
): Promise<string> {
  const history = params.continuation
    ? [
        ...params.turns,
        { role: "user" as const, content: CONTINUE_USER },
      ]
    : params.turns;

  const promptCtx = {
    character: params.character,
    loreEntries: params.loreEntries,
    turns: history,
    bandSummary: params.bandSummary,
    chapterSummary: params.chapterSummary,
    rollingSummary: params.rollingSummary,
    settings: params.storySettings,
  };

  const { messages, activeLoreCount } =
    params.chatMode === "group"
      ? buildGroupChatMessages(promptCtx, params.cast)
      : buildChatMessages(promptCtx);

  params.onLoreCount?.(activeLoreCount);

  let full = "";
  await new Promise<void>((resolve) => {
    streamOpenRouterChat(
      params.settings,
      messages,
      {
        onToken: (t) => {
          full += t;
          params.onToken?.(t);
        },
        onDone: () => resolve(),
        onError: () => resolve(),
      },
      params.signal,
    );
  });

  return full;
}

export function parseAssistantBlocks(
  chatMode: ChatMode,
  full: string,
): Array<{ speakerSlug: string; content: string }> {
  if (chatMode === "group") {
    const blocks = parseSpeakerBlocks(full);
    if (blocks.length) return blocks;
  }
  return [{ speakerSlug: "narrator", content: full }];
}

import {
  formatLoreForPrompt,
  scanActiveLore,
  trimLoreToBudget,
} from "@/lib/lore/scanner";
import type {
  ChatTurn,
  LoreEntry,
  StorySettings,
  StoryCharacterCard,
} from "@/lib/types";
import { DEFAULT_STORY_SETTINGS } from "@/lib/types";
import { formatCastMemoryForPrompt } from "@/lib/memory/characterMemory";
import { buildStoryMemorySections } from "@/lib/memory/storyMemory";
import type { CharacterRow } from "@/lib/db/stories";
import type { StoryPlotState } from "@/lib/memory/plotState";
import type { StoryPin } from "@/lib/memory/storyPins";
import type { StoryTimeline } from "@/lib/memory/storyTimeline";
import {
  isSteeringUserTurn,
  stripSteeringTurnPrefix,
} from "@/lib/chat/playerSteering";
import { stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import { buildStorytellerScriptInstructions } from "@/lib/prompt/storytellerScript";
import {
  normalizeStoryContentLocale,
  protagonistPromptBlock,
  type StoryContentLocale,
} from "@/lib/story/protagonist";

export interface PromptContext {
  character: StoryCharacterCard;
  loreEntries: LoreEntry[];
  turns: ChatTurn[];
  bandSummary?: string | null;
  chapterSummary?: string | null;
  rollingSummary?: string | null;
  chapterTitle?: string | null;
  phaseHint?: string | null;
  chapterIndex?: number;
  closedChapterCount?: number;
  plotState?: StoryPlotState | null;
  timeline?: StoryTimeline | null;
  pinnedNotes?: StoryPin[];
  allCast?: CharacterRow[];
  settings?: Partial<StorySettings>;
  storyLocale?: StoryContentLocale | string | null;
}

export function buildChatMessages(ctx: PromptContext): {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  activeLoreCount: number;
} {
  const settings = { ...DEFAULT_STORY_SETTINGS, ...ctx.settings };
  const locale = normalizeStoryContentLocale(ctx.storyLocale);
  const recent = ctx.turns.slice(-settings.recentTurnCount);
  const scanTexts = recent.map((t) => t.content);

  let activeLore = scanActiveLore(ctx.loreEntries, scanTexts);
  activeLore = trimLoreToBudget(activeLore, settings.loreTokenBudget);
  const loreBlock = formatLoreForPrompt(activeLore);

  const systemParts: string[] = [];

  if (ctx.character.system_prompt) {
    systemParts.push(ctx.character.system_prompt);
  }

  if (ctx.character.scenario) {
    const advanced =
      (ctx.chapterIndex ?? 0) > 2 || (ctx.closedChapterCount ?? 0) >= 2;
    if (advanced) {
      const excerpt =
        ctx.character.scenario.length > 900
          ? `${ctx.character.scenario.slice(0, 900)}…`
          : ctx.character.scenario;
      systemParts.push(
        `## Original setup (historical — do NOT replay opening beats)\nThe story already moved past its beginning. Use this only as background:\n${excerpt}`,
      );
    } else {
      systemParts.push(`## Scenario\n${ctx.character.scenario}`);
    }
  }

  const castMemory = formatCastMemoryForPrompt(ctx.allCast ?? []);
  if (castMemory) systemParts.push(castMemory);

  systemParts.push(
    ...buildStoryMemorySections({
      plotState: ctx.plotState,
      timeline: ctx.timeline,
      pinnedNotes: ctx.pinnedNotes ?? ctx.settings?.pinnedNotes,
      bandSummary: ctx.bandSummary,
      priorChapterSummaries: ctx.chapterSummary,
      rollingSummary: ctx.rollingSummary,
      chapterTitle: ctx.chapterTitle,
      phaseHint: ctx.phaseHint,
      chapterIndex: ctx.chapterIndex,
      closedChapterCount: ctx.closedChapterCount,
      // Phase 7.3: reflection layer
      reflections: ctx.settings?.storyReflections ?? null,
    }),
  );

  if (loreBlock) {
    systemParts.push(loreBlock);
  }

  if (ctx.character.post_history_instructions) {
    systemParts.push(
      `## Instructions (always follow)\n${ctx.character.post_history_instructions}`,
    );
  }

  if (settings.protagonist?.displayName?.trim()) {
    systemParts.push(protagonistPromptBlock(settings.protagonist, locale));
  }

  systemParts.push(
    buildStorytellerScriptInstructions(
      ctx.allCast ?? [],
      locale,
      settings.protagonist,
    ),
  );

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [{ role: "system", content: systemParts.join("\n\n") }];

  for (let i = 0; i < recent.length; i++) {
    const turn = recent[i];
    if (turn.role === "system") continue;
    let content = stripSpeakerTags(turn.content);
    if (turn.role === "user" && isSteeringUserTurn(content)) {
      const display = stripSteeringTurnPrefix(content);
      const resolved =
        recent.slice(i + 1).some((t) => t.role === "assistant");
      if (resolved) {
        content =
          locale === "de"
            ? `[Spieler-Steuerung (bereits umgesetzt): ${display}]`
            : `[Player steering (already applied): ${display}]`;
      } else {
        content =
          locale === "de"
            ? `[Spieler steuert: ${display}]`
            : `[Player steers: ${display}]`;
      }
    }
    messages.push({ role: turn.role, content });
  }

  return { messages, activeLoreCount: activeLore.length };
}

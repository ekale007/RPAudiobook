import {
  formatLoreForPrompt,
  scanActiveLore,
  trimLoreToBudget,
} from "@/lib/lore/scanner";
import type {
  ChatTurn,
  LoreEntry,
  StorySettings,
  WryTourCharacter,
} from "@/lib/types";
import { DEFAULT_STORY_SETTINGS } from "@/lib/types";

export interface PromptContext {
  character: WryTourCharacter;
  loreEntries: LoreEntry[];
  turns: ChatTurn[];
  bandSummary?: string | null;
  chapterSummary?: string | null;
  rollingSummary?: string | null;
  settings?: Partial<StorySettings>;
}

export function buildChatMessages(ctx: PromptContext): {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  activeLoreCount: number;
} {
  const settings = { ...DEFAULT_STORY_SETTINGS, ...ctx.settings };
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
    systemParts.push(`## Scenario\n${ctx.character.scenario}`);
  }

  if (ctx.bandSummary) {
    systemParts.push(`## Story so far (volume)\n${ctx.bandSummary}`);
  }

  if (ctx.chapterSummary) {
    systemParts.push(`## Previous chapters\n${ctx.chapterSummary}`);
  }

  if (ctx.rollingSummary) {
    systemParts.push(`## Current chapter (summary)\n${ctx.rollingSummary}`);
  }

  if (loreBlock) {
    systemParts.push(loreBlock);
  }

  if (ctx.character.post_history_instructions) {
    systemParts.push(
      `## Instructions (always follow)\n${ctx.character.post_history_instructions}`,
    );
  }

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [{ role: "system", content: systemParts.join("\n\n") }];

  for (const turn of recent) {
    if (turn.role === "system") continue;
    const content = turn.speakerSlug
      ? `<<speaker:${turn.speakerSlug}>>\n${turn.content}`
      : turn.content;
    messages.push({ role: turn.role, content });
  }

  return { messages, activeLoreCount: activeLore.length };
}

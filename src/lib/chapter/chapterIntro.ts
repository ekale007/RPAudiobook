import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { TurnRow } from "@/lib/db/stories";
import type { OpenRouterSettings } from "@/lib/types";

export type ChapterIntroMode =
  | "empty"
  | "last_narration"
  | "last_scene"
  | "ai_bridge"
  | "custom";

export type ChapterIntroOption = {
  id: ChapterIntroMode;
  label: string;
  hint: string;
};

export const CHAPTER_INTRO_OPTIONS: ChapterIntroOption[] = [
  {
    id: "empty",
    label: "Leer",
    hint: "Keine Eröffnung — du startest selbst",
  },
  {
    id: "last_narration",
    label: "Letzte Erzählung",
    hint: "Letzte Erzähler-/Antwort-Nachricht übernehmen",
  },
  {
    id: "last_scene",
    label: "Letzte Szene",
    hint: "Alle Antworten seit deiner letzten Nachricht",
  },
  {
    id: "ai_bridge",
    label: "KI-Übergang",
    hint: "Neue Eröffnung aus der Kapitel-Zusammenfassung",
  },
  {
    id: "custom",
    label: "Eigener Text",
    hint: "Freitext als Eröffnung",
  },
];

/** Assistant turns at the end of the chapter (after last user message). */
export function getTrailingAssistantTurns(turns: TurnRow[]): TurnRow[] {
  const out: TurnRow[] = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === "assistant") {
      out.unshift(turns[i]);
    } else {
      break;
    }
  }
  return out;
}

export function getLastAssistantTurn(turns: TurnRow[]): TurnRow | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === "assistant") return turns[i];
  }
  return null;
}

export function previewText(text: string, max = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export async function generateChapterBridgeIntro(
  settings: OpenRouterSettings,
  opts: {
    previousChapterTitle: string;
    chapterSummary: string;
    nextChapterTitle: string;
    phaseHint?: string | null;
    lastSceneExcerpt?: string | null;
  },
): Promise<string> {
  const messages = [
    {
      role: "system",
      content:
        'You write opening scenes for interactive fiction. Second person ("You"). 2-4 short paragraphs. Continue naturally from the previous chapter — do not paste the summary verbatim. End at a clear pause inviting the player to act or speak. No bullet lists.',
    },
    {
      role: "user",
      content: [
        `Previous chapter: ${opts.previousChapterTitle}`,
        `Summary:\n${opts.chapterSummary}`,
        `New chapter: ${opts.nextChapterTitle}`,
        opts.phaseHint ? `Timeline: ${opts.phaseHint}` : null,
        opts.lastSceneExcerpt
          ? `Last moment (tone reference):\n${opts.lastSceneExcerpt.slice(0, 1200)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  return completeOpenRouter(settings, messages, {
    maxTokens: 900,
    temperature: 0.82,
  });
}

export type ResolvedChapterIntro = {
  turns: Array<{ content: string; speakerSlug?: string | null }>;
};

export async function resolveChapterIntro(
  mode: ChapterIntroMode,
  params: {
    settings: OpenRouterSettings;
    priorTurns: TurnRow[];
    chapterSummary: string;
    previousChapterTitle: string;
    nextChapterTitle: string;
    phaseHint?: string | null;
    customText?: string;
  },
): Promise<ResolvedChapterIntro> {
  if (mode === "empty") {
    return { turns: [] };
  }

  if (mode === "custom") {
    const text = params.customText?.trim();
    if (!text) return { turns: [] };
    return { turns: [{ content: text, speakerSlug: "narrator" }] };
  }

  if (mode === "last_narration") {
    const last = getLastAssistantTurn(params.priorTurns);
    if (!last) return { turns: [] };
    return {
      turns: [
        {
          content: last.content,
          speakerSlug: last.speaker_slug ?? "narrator",
        },
      ],
    };
  }

  if (mode === "last_scene") {
    const trailing = getTrailingAssistantTurns(params.priorTurns);
    if (!trailing.length) return { turns: [] };
    return {
      turns: trailing.map((t) => ({
        content: t.content,
        speakerSlug: t.speaker_slug ?? "narrator",
      })),
    };
  }

  if (mode === "ai_bridge") {
    const last = getLastAssistantTurn(params.priorTurns);
    const text = await generateChapterBridgeIntro(params.settings, {
      previousChapterTitle: params.previousChapterTitle,
      chapterSummary: params.chapterSummary,
      nextChapterTitle: params.nextChapterTitle,
      phaseHint: params.phaseHint,
      lastSceneExcerpt: last?.content ?? null,
    });
    if (!text.trim()) return { turns: [] };
    return { turns: [{ content: text.trim(), speakerSlug: "narrator" }] };
  }

  return { turns: [] };
}

import { extractPlotState } from "@/lib/memory/plotState";
import type { StoryPlotState } from "@/lib/memory/plotState";
import type { TurnRow } from "@/lib/db/stories";
import { updateStorySettings } from "@/lib/db/stories";
import type { ChatTurn, OpenRouterSettings } from "@/lib/types";

function turnsToChat(rows: TurnRow[]): ChatTurn[] {
  return rows.map((t) => ({
    role: t.role as ChatTurn["role"],
    content: t.content,
    speakerSlug: t.speaker_slug,
  }));
}

/** Lock plot state at chapter end so the next chapter starts from the latest truth. */
export async function finalizeChapterPlotState(args: {
  settings: OpenRouterSettings;
  storyId: string;
  rows: TurnRow[];
  chapterTitle: string;
  phaseHint?: string | null;
  existingPlot?: StoryPlotState | null;
}): Promise<StoryPlotState | null> {
  if (!args.rows.some((r) => r.role !== "system")) {
    return args.existingPlot ?? null;
  }

  const plot = await extractPlotState(
    args.settings,
    turnsToChat(args.rows),
    args.existingPlot ?? null,
    {
      chapterTitle: args.chapterTitle,
      phaseHint: args.phaseHint,
    },
  );

  await updateStorySettings(args.storyId, { plotState: plot });
  return plot;
}

/** Prefer in-story time from plot state over a static seed phase hint. */
export function phaseHintForNextChapter(
  plot: StoryPlotState | null | undefined,
  fallbackPhaseHint?: string | null,
): string | undefined {
  const fromPlot = plot?.timeLabel?.trim();
  if (fromPlot && !isStaleSeedPhase(fromPlot)) {
    return fromPlot;
  }
  const fallback = fallbackPhaseHint?.trim();
  if (fallback && !isStaleSeedPhase(fallback)) {
    return fallback;
  }
  return undefined;
}

function isStaleSeedPhase(value: string): boolean {
  const v = value.toLowerCase();
  return (
    v.includes("hours 0-4") ||
    v.includes("act i") ||
    v.includes("akt i") ||
    v.includes("first night") ||
    v.includes("erste nacht")
  );
}

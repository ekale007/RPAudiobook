import { concatAudioBlobs } from "@/lib/audio/concatAudioBlobs";
import {
  audioFilenameForChapter,
  downloadBlob,
} from "@/lib/audio/downloadBlob";
import { downloadTurnAudio } from "@/lib/db/ttsStorage";
import type { TurnRow } from "@/lib/db/stories";

/** Minimum cloud assistant clips before offering chapter export. */
export const CHAPTER_EXPORT_MIN_COUNT = 3;

/** Minimum share of assistant turns in cloud (unless complete). */
export const CHAPTER_EXPORT_MIN_RATIO = 0.8;

export type ChapterCloudAudioStats = {
  assistantTurns: number;
  cloudTurns: number;
  ratio: number;
  canExport: boolean;
  complete: boolean;
  exportableTurns: TurnRow[];
};

export function analyzeChapterCloudAudio(turns: TurnRow[]): ChapterCloudAudioStats {
  const assistants = turns.filter((t) => t.role === "assistant");
  const exportableTurns = assistants.filter((t) =>
    Boolean(t.audio_storage_path?.trim()),
  );
  const assistantTurns = assistants.length;
  const cloudTurns = exportableTurns.length;
  const ratio = assistantTurns > 0 ? cloudTurns / assistantTurns : 0;
  const complete = assistantTurns > 0 && cloudTurns === assistantTurns;
  const canExport =
    cloudTurns >= CHAPTER_EXPORT_MIN_COUNT &&
    (complete || ratio >= CHAPTER_EXPORT_MIN_RATIO);

  return {
    assistantTurns,
    cloudTurns,
    ratio,
    canExport,
    complete,
    exportableTurns,
  };
}

export async function exportChapterAudioFromCloud(
  turns: TurnRow[],
  chapterTitle?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const stats = analyzeChapterCloudAudio(turns);
  if (!stats.canExport) {
    return {
      ok: false,
      error: `Mindestens ${CHAPTER_EXPORT_MIN_COUNT} Cloud-Aufnahmen und ${Math.round(CHAPTER_EXPORT_MIN_RATIO * 100)} % der Erzähler-Nachrichten nötig.`,
    };
  }

  const blobs: Blob[] = [];
  for (const turn of stats.exportableTurns) {
    const path = turn.audio_storage_path?.trim();
    if (!path) continue;
    const blob = await downloadTurnAudio(path);
    if (!blob) {
      return {
        ok: false,
        error: "Eine Cloud-Aufnahme konnte nicht geladen werden.",
      };
    }
    blobs.push(blob);
  }

  if (!blobs.length) {
    return { ok: false, error: "Keine Cloud-Aufnahmen gefunden." };
  }

  const merged = await concatAudioBlobs(blobs);
  downloadBlob(
    merged,
    audioFilenameForChapter(chapterTitle, stats.complete),
  );
  return { ok: true };
}

/** Trigger a file download in the browser (PWA / mobile: opens share sheet or Downloads). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function safeChapterSlug(chapterTitle?: string | null): string {
  return (chapterTitle ?? "kapitel")
    .replace(/[^\wäöüÄÖÜß\-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function audioFilenameForTurn(
  turnId: string,
  chapterTitle?: string | null,
): string {
  const safeChapter = safeChapterSlug(chapterTitle);
  const shortId = turnId.replace(/[^a-z0-9-]/gi, "").slice(0, 8);
  return `hoerbuchki-${safeChapter}-${shortId}.mp3`;
}

export function audioFilenameForChapter(
  chapterTitle?: string | null,
  complete = true,
): string {
  const safeChapter = safeChapterSlug(chapterTitle);
  const suffix = complete ? "kapitel" : "kapitel-teil";
  return `hoerbuchki-${safeChapter}-${suffix}.wav`;
}

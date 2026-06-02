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

export function audioFilenameForTurn(
  turnId: string,
  chapterTitle?: string | null,
): string {
  const safeChapter = (chapterTitle ?? "kapitel")
    .replace(/[^\wäöüÄÖÜß\-]+/gi, "-")
    .slice(0, 40);
  const shortId = turnId.replace(/[^a-z0-9-]/gi, "").slice(0, 8);
  return `hoerbuchki-${safeChapter}-${shortId}.mp3`;
}

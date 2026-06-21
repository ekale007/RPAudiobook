/** Trigger a browser download for a generated TTS blob. */
export function downloadAudioBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const safe =
    filename.replace(/[^\w.\-äöüÄÖÜß]+/g, "_").replace(/_+/g, "_") ||
    "audio.mp3";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safe.endsWith(".mp3") ? safe : `${safe}.mp3`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Tiny silent WAV — unlocks mobile autoplay for chained clips in one tap session. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

let unlockEl: HTMLAudioElement | null = null;

/** Call synchronously inside click/touch handlers before async TTS work. */
export function unlockAudioForAutoplay(): void {
  if (typeof window === "undefined") return;
  try {
    if (!unlockEl) {
      unlockEl = new Audio(SILENT_WAV);
      unlockEl.preload = "auto";
    }
    unlockEl.currentTime = 0;
    void unlockEl.play().catch(() => {
      /* ignore — best-effort unlock */
    });
  } catch {
    /* ignore */
  }
}

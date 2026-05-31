/** Tiny silent WAV — unlocks mobile autoplay for chained clips in one tap session. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

let unlockEl: HTMLAudioElement | null = null;
let sessionKeepalive: HTMLAudioElement | null = null;

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

/**
 * Keep the browser audio session open across long async gaps (LLM generation).
 * Start on user gesture; stop when autoplay / drive mode ends.
 */
export function startAudioSession(): void {
  if (typeof window === "undefined") return;
  unlockAudioForAutoplay();
  try {
    if (!sessionKeepalive) {
      sessionKeepalive = new Audio(SILENT_WAV);
      sessionKeepalive.loop = true;
      sessionKeepalive.preload = "auto";
    }
    sessionKeepalive.currentTime = 0;
    void sessionKeepalive.play().catch(() => {
      /* ignore */
    });
  } catch {
    /* ignore */
  }
}

export function stopAudioSession(): void {
  if (!sessionKeepalive) return;
  try {
    sessionKeepalive.pause();
    sessionKeepalive.currentTime = 0;
  } catch {
    /* ignore */
  }
}

import {
  loadTtsReadOnly,
  saveTtsReadOnly,
} from "@/lib/storage/ttsPlaybackSettings";
import {
  primeTtsAudioContext,
  stopTtsAudioContext,
} from "@/lib/tts/mobileAudioPlayback";
import {
  requestScreenWakeLock,
  releaseScreenWakeLock,
} from "@/lib/tts/screenWakeLock";

/** Tiny silent WAV — unlocks mobile autoplay for chained clips in one tap session. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

let unlockEl: HTMLAudioElement | null = null;
let sessionKeepalive: HTMLAudioElement | null = null;
let visibilityBound = false;
let readOnlyMode = false;
let ttsContentPlaying = false;

export function isTtsReadOnly(): boolean {
  return readOnlyMode;
}

/** Hydrate from localStorage on client mount. */
export function syncTtsReadOnlyFromStorage(): boolean {
  readOnlyMode = loadTtsReadOnly();
  if (readOnlyMode) stopAudioSession();
  return readOnlyMode;
}

export function setTtsReadOnly(enabled: boolean): void {
  readOnlyMode = enabled;
  saveTtsReadOnly(enabled);
  if (enabled) stopAudioSession();
}

function configureUnlockElement(audio: HTMLAudioElement): void {
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  audio.preload = "auto";
}

function bindVisibilityResume(): void {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void primeTtsAudioContext();
      return;
    }
    /* Do not restart silent keepalive while TTS is playing — iOS allows one stream. */
    if (ttsContentPlaying) return;
    try {
      if (sessionKeepalive && sessionKeepalive.paused) {
        void sessionKeepalive.play().catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  });
}

/** Pause silent keepalive while real TTS plays (iOS single audio session). */
export function setTtsContentPlaying(playing: boolean): void {
  ttsContentPlaying = playing;
  if (typeof window === "undefined" || readOnlyMode) return;
  try {
    if (!sessionKeepalive) return;
    if (playing) {
      sessionKeepalive.pause();
    } else {
      sessionKeepalive.currentTime = 0;
      void sessionKeepalive.play().catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
}

/** Call synchronously inside click/touch handlers before async TTS work. */
export function unlockAudioForAutoplay(): void {
  if (typeof window === "undefined" || readOnlyMode) return;
  void primeTtsAudioContext();
  try {
    if (!unlockEl) {
      unlockEl = new Audio(SILENT_WAV);
      configureUnlockElement(unlockEl);
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
  if (typeof window === "undefined" || readOnlyMode) return;
  unlockAudioForAutoplay();
  bindVisibilityResume();
  void requestScreenWakeLock();
  try {
    if (!sessionKeepalive) {
      sessionKeepalive = new Audio(SILENT_WAV);
      sessionKeepalive.loop = true;
      configureUnlockElement(sessionKeepalive);
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
  if (sessionKeepalive) {
    try {
      sessionKeepalive.pause();
      sessionKeepalive.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  stopTtsAudioContext();
  void releaseScreenWakeLock();
}

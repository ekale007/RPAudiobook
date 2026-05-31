const STORAGE_KEY = "hoerbuch-tts-playback-rate";
const AUTOPLAY_KEY = "hoerbuch-tts-autoplay";

export const PLAYBACK_RATE_MIN = 0.75;
export const PLAYBACK_RATE_MAX = 1.5;
export const PLAYBACK_RATE_STEP = 0.05;
export const PLAYBACK_RATE_DEFAULT = 1;

export function loadPlaybackRate(): number {
  if (typeof window === "undefined") return PLAYBACK_RATE_DEFAULT;
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = raw ? Number.parseFloat(raw) : NaN;
  if (!Number.isFinite(n)) return PLAYBACK_RATE_DEFAULT;
  return clampPlaybackRate(n);
}

export function savePlaybackRate(rate: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(clampPlaybackRate(rate)));
}

export function clampPlaybackRate(rate: number): number {
  const stepped =
    Math.round(rate / PLAYBACK_RATE_STEP) * PLAYBACK_RATE_STEP;
  return Math.min(
    PLAYBACK_RATE_MAX,
    Math.max(PLAYBACK_RATE_MIN, Number(stepped.toFixed(2))),
  );
}

export function formatPlaybackRate(rate: number): string {
  return `${rate.toFixed(2)}×`;
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function loadTtsAutoplay(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(AUTOPLAY_KEY);
  if (raw === null) return true;
  return raw === "1";
}

export function saveTtsAutoplay(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTOPLAY_KEY, enabled ? "1" : "0");
}

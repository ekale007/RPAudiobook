let sentinel: WakeLockSentinel | null = null;

/** Keep screen on during long TTS / Fahrmodus sessions (mobile). */
export async function requestScreenWakeLock(): Promise<void> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
  try {
    if (sentinel && !sentinel.released) return;
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
  } catch {
    /* unsupported or low battery */
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  try {
    await sentinel?.release();
  } catch {
    /* ignore */
  }
  sentinel = null;
}

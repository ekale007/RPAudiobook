/** Mobile Safari / Chrome need longer waits and explicit unlock gestures. */

export function isMobilePlaybackDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function ttsPlayerWaitMs(options?: { forDrive?: boolean }): number {
  const mobile = isMobilePlaybackDevice();
  if (options?.forDrive) return mobile ? 45_000 : 20_000;
  return mobile ? 15_000 : 4_000;
}

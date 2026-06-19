import { configureMobileHtmlAudio } from "@/lib/tts/mobileAudioPlayback";

/** One HTMLMediaElement for iOS — chained clips must reuse the same tag. */
let sharedAudio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let ownerTurnId: string | null = null;

export function getSharedTtsHtmlAudio(): HTMLAudioElement {
  if (typeof window === "undefined") {
    throw new Error("Shared TTS audio requires a browser");
  }
  if (!sharedAudio) {
    sharedAudio = new Audio();
    configureMobileHtmlAudio(sharedAudio);
  }
  return sharedAudio;
}

export function sharedTtsOwnerTurnId(): string | null {
  return ownerTurnId;
}

export function bindSharedTtsSource(blob: Blob, turnId: string): HTMLAudioElement {
  const audio = getSharedTtsHtmlAudio();
  if (ownerTurnId && ownerTurnId !== turnId) {
    window.dispatchEvent(
      new CustomEvent("tts-shared-handoff", {
        detail: { from: ownerTurnId, to: turnId },
      }),
    );
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  objectUrl = URL.createObjectURL(blob);
  audio.src = objectUrl;
  ownerTurnId = turnId;
  return audio;
}

export function pauseSharedTtsHtmlAudio(): void {
  sharedAudio?.pause();
}

export function stopSharedTtsHtmlAudio(): void {
  if (!sharedAudio) return;
  sharedAudio.pause();
  sharedAudio.currentTime = 0;
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  ownerTurnId = null;
}

/**
 * iOS Safari: chained TTS after async fetch needs a running AudioContext
 * unlocked in the same user gesture (Autoplay toggle / Fahrmodus / ▶).
 */

import { isMobilePlaybackDevice } from "@/lib/tts/mobilePlayback";

let ttsCtx: AudioContext | null = null;
let keepaliveSource: AudioBufferSourceNode | null = null;
let keepaliveGain: GainNode | null = null;
let activeTtsSource: AudioBufferSourceNode | null = null;

export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** Prefer Web Audio for autoplay chains on iOS (and iPadOS desktop UA). */
export function shouldUseWebAudioForTts(): boolean {
  return isIOSDevice();
}

function getOrCreateTtsContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ttsCtx) {
    const Ctx =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!Ctx) return null;
    ttsCtx = new Ctx();
  }
  return ttsCtx;
}

function startContextKeepalive(ctx: AudioContext): void {
  if (keepaliveSource) return;
  try {
    const buffer = ctx.createBuffer(1, 2, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    channel[0] = 0;
    channel[1] = 0;
    keepaliveSource = ctx.createBufferSource();
    keepaliveSource.buffer = buffer;
    keepaliveSource.loop = true;
    keepaliveGain = ctx.createGain();
    keepaliveGain.gain.value = 0.0001;
    keepaliveSource.connect(keepaliveGain);
    keepaliveGain.connect(ctx.destination);
    keepaliveSource.start();
  } catch {
    /* ignore */
  }
}

function stopContextKeepalive(): void {
  try {
    keepaliveSource?.stop();
  } catch {
    /* ignore */
  }
  keepaliveSource = null;
  keepaliveGain = null;
}

/** Call on pointer-down / session start — keeps iOS audio session warm. */
export async function primeTtsAudioContext(): Promise<void> {
  const ctx = getOrCreateTtsContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  startContextKeepalive(ctx);
}

export function stopTtsAudioContext(): void {
  stopActiveTtsSource();
  stopContextKeepalive();
  if (ttsCtx) {
    void ttsCtx.close().catch(() => undefined);
    ttsCtx = null;
  }
}

export function stopActiveTtsSource(): void {
  try {
    activeTtsSource?.stop();
  } catch {
    /* ignore */
  }
  activeTtsSource = null;
}

export function configureMobileHtmlAudio(audio: HTMLAudioElement): void {
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  if (isMobilePlaybackDevice()) {
    audio.preload = "auto";
  }
}

export type WebAudioPlayHandle = {
  stop: () => void;
  durationSec: number;
};

/** Plays blob to completion on the shared TTS AudioContext (iOS autoplay). */
export function playBlobViaWebAudio(
  blob: Blob,
  playbackRate: number,
): Promise<{ durationSec: number }> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const ctx = getOrCreateTtsContext();
      if (!ctx) {
        reject(new Error("AudioContext nicht verfügbar"));
        return;
      }
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch (e) {
          reject(e);
          return;
        }
      }

      stopActiveTtsSource();

      try {
        const ab = await blob.arrayBuffer();
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = Math.max(0.5, Math.min(playbackRate, 3));
        source.connect(ctx.destination);
        activeTtsSource = source;

        const durationSec = buffer.duration / source.playbackRate.value;

        source.onended = () => {
          if (activeTtsSource === source) activeTtsSource = null;
          resolve({ durationSec });
        };

        source.start(0);
      } catch (e) {
        activeTtsSource = null;
        reject(e);
      }
    })();
  });
}

export async function playBlobViaWebAudioWithHandle(
  blob: Blob,
  playbackRate: number,
): Promise<WebAudioPlayHandle> {
  const ctx = getOrCreateTtsContext();
  if (!ctx) throw new Error("AudioContext nicht verfügbar");
  if (ctx.state === "suspended") await ctx.resume();

  stopActiveTtsSource();

  const ab = await blob.arrayBuffer();
  const buffer = await ctx.decodeAudioData(ab.slice(0));
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = Math.max(0.5, Math.min(playbackRate, 3));
  source.connect(ctx.destination);
  activeTtsSource = source;
  const durationSec = buffer.duration / source.playbackRate.value;

  return {
    durationSec,
    stop: () => {
      try {
        source.stop();
      } catch {
        /* ignore */
      }
      if (activeTtsSource === source) activeTtsSource = null;
    },
  };
}

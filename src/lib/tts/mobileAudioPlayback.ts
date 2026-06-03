/**
 * iOS Safari: chained TTS after async fetch needs a running AudioContext
 * unlocked in the same user gesture (Autoplay toggle / Fahrmodus / ▶).
 */

import { isMobilePlaybackDevice } from "@/lib/tts/mobilePlayback";

let ttsCtx: AudioContext | null = null;
let keepaliveSource: AudioBufferSourceNode | null = null;
let keepaliveGain: GainNode | null = null;

type ManagedPlayback = {
  buffer: AudioBuffer;
  playbackRate: number;
  source: AudioBufferSourceNode | null;
  /** Buffer offset (seconds) when the current source started. */
  sourceOffsetSec: number;
  /** ctx.currentTime when the current source started. */
  sourceStartedAtCtx: number;
  /** Last known position when paused or between segments. */
  positionSec: number;
  ended: boolean;
};

let managed: ManagedPlayback | null = null;
let onPlaybackComplete: (() => void) | null = null;

function completePlayback(): void {
  const cb = onPlaybackComplete;
  onPlaybackComplete = null;
  cb?.();
}

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

export function isWebAudioTtsActive(): boolean {
  return managed != null && !managed.ended;
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
  stopManagedPlayback();
  stopContextKeepalive();
  if (ttsCtx) {
    void ttsCtx.close().catch(() => undefined);
    ttsCtx = null;
  }
}

export function stopActiveTtsSource(): void {
  stopManagedPlayback();
}

function playbackDurationSec(p: ManagedPlayback): number {
  return p.buffer.duration / p.playbackRate;
}

function currentPositionSec(p: ManagedPlayback, ctx: AudioContext): number {
  if (!p.source) return Math.min(p.positionSec, playbackDurationSec(p));
  const elapsed = ctx.currentTime - p.sourceStartedAtCtx;
  const pos = p.sourceOffsetSec + elapsed * p.playbackRate;
  return Math.min(pos, playbackDurationSec(p));
}

function stopSource(p: ManagedPlayback): void {
  if (!p.source) return;
  const source = p.source;
  source.onended = null;
  try {
    source.stop();
  } catch {
    /* ignore */
  }
  source.disconnect();
  p.source = null;
}

function startSourceFromOffset(
  p: ManagedPlayback,
  ctx: AudioContext,
  offsetSec: number,
  onEnded: () => void,
): void {
  stopSource(p);
  const source = ctx.createBufferSource();
  source.buffer = p.buffer;
  source.playbackRate.value = p.playbackRate;
  source.connect(ctx.destination);
  p.source = source;
  p.sourceOffsetSec = offsetSec;
  p.sourceStartedAtCtx = ctx.currentTime;
  p.positionSec = offsetSec;

  source.onended = () => {
    if (p.source !== source) return;
    p.source = null;
    p.positionSec = playbackDurationSec(p);
    p.ended = true;
    managed = null;
    onEnded();
  };

  const remain = playbackDurationSec(p) - offsetSec;
  if (remain <= 0.02) {
    p.ended = true;
    managed = null;
    onEnded();
    return;
  }
  source.start(0, offsetSec);
}

function stopManagedPlayback(): void {
  if (!managed) return;
  const ctx = ttsCtx;
  if (ctx && managed.source) {
    managed.positionSec = currentPositionSec(managed, ctx);
  }
  stopSource(managed);
  managed = null;
  onPlaybackComplete = null;
}

export function getWebAudioPlaybackPosition(): number {
  if (!managed || !ttsCtx) return 0;
  return currentPositionSec(managed, ttsCtx);
}

export function getWebAudioPlaybackDuration(): number {
  if (!managed) return 0;
  return playbackDurationSec(managed);
}

/** Pause in-buffer (for ▶/‖ controls). */
export function pauseWebAudioPlayback(): void {
  if (!managed || !ttsCtx) return;
  managed.positionSec = currentPositionSec(managed, ttsCtx);
  stopSource(managed);
}

/** Resume after pauseWebAudioPlayback (completes the active playBlobViaWebAudio promise). */
export function resumeWebAudioPlayback(): void {
  if (!managed || !ttsCtx) return;
  if (managed.ended) return;
  startSourceFromOffset(managed, ttsCtx, managed.positionSec, completePlayback);
}

export function seekWebAudioPlayback(offsetSec: number): void {
  if (!managed || !ttsCtx) return;
  const dur = playbackDurationSec(managed);
  const t = Math.min(dur, Math.max(0, offsetSec));
  managed.positionSec = t;
  if (managed.source) {
    startSourceFromOffset(managed, ttsCtx, t, completePlayback);
  }
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

      stopManagedPlayback();

      try {
        const ab = await blob.arrayBuffer();
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        const rate = Math.max(0.5, Math.min(playbackRate, 3));
        const durationSec = buffer.duration / rate;

        const state: ManagedPlayback = {
          buffer,
          playbackRate: rate,
          source: null,
          sourceOffsetSec: 0,
          sourceStartedAtCtx: 0,
          positionSec: 0,
          ended: false,
        };
        managed = state;
        onPlaybackComplete = () => resolve({ durationSec });

        startSourceFromOffset(state, ctx, 0, completePlayback);
      } catch (e) {
        managed = null;
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

  stopManagedPlayback();

  const ab = await blob.arrayBuffer();
  const buffer = await ctx.decodeAudioData(ab.slice(0));
  const rate = Math.max(0.5, Math.min(playbackRate, 3));
  const durationSec = buffer.duration / rate;

  const state: ManagedPlayback = {
    buffer,
    playbackRate: rate,
    source: null,
    sourceOffsetSec: 0,
    sourceStartedAtCtx: 0,
    positionSec: 0,
    ended: false,
  };
  managed = state;

  onPlaybackComplete = () => undefined;
  startSourceFromOffset(state, ctx, 0, completePlayback);

  return {
    durationSec,
    stop: () => {
      stopManagedPlayback();
    },
  };
}

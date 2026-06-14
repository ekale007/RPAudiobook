import { getSfxEntry, type SfxEntry } from "@/lib/audio/sfxCatalog";

type ActiveLoop = {
  id: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  baseVolume: number;
  paused: boolean;
};

const SPEECH_DUCK_GAIN = 0.35;

let ctx: AudioContext | null = null;
const activeLoops = new Map<string, ActiveLoop>();
let speechDucked = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

async function ensureContextRunning(): Promise<AudioContext | null> {
  const audioCtx = getContext();
  if (!audioCtx) return null;
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {
      /* ignore */
    }
  }
  return audioCtx;
}

function effectiveVolume(entry: ActiveLoop): number {
  if (entry.paused) return 0;
  return entry.baseVolume * (speechDucked ? SPEECH_DUCK_GAIN : 1);
}

function applyLoopGain(entry: ActiveLoop): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  entry.gain.gain.setValueAtTime(effectiveVolume(entry), audioCtx.currentTime);
}

function applyAllLoopGains(): void {
  for (const active of activeLoops.values()) {
    applyLoopGain(active);
  }
}

async function loadBuffer(entry: SfxEntry): Promise<AudioBuffer | null> {
  const audioCtx = getContext();
  if (!audioCtx) return null;
  try {
    const res = await fetch(entry.path);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return await audioCtx.decodeAudioData(ab.slice(0));
  } catch {
    return null;
  }
}

export async function playSfx(id: string): Promise<void> {
  const entry = getSfxEntry(id);
  if (!entry) return;
  const audioCtx = getContext();
  if (!audioCtx) return;

  if (entry.loop) {
    await startLoop(entry);
    return;
  }

  const buffer = await loadBuffer(entry);
  if (!buffer) return;
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  gain.gain.value = entry.volume;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

async function startLoop(entry: SfxEntry): Promise<void> {
  const existing = activeLoops.get(entry.id);
  if (existing) {
    if (existing.paused) {
      resumeSfxLoop(entry.id);
    }
    return;
  }
  const audioCtx = await ensureContextRunning();
  if (!audioCtx) return;
  const buffer = await loadBuffer(entry);
  if (!buffer) return;

  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
  const active: ActiveLoop = {
    id: entry.id,
    source,
    gain,
    baseVolume: entry.volume,
    paused: false,
  };
  activeLoops.set(entry.id, active);
  applyLoopGain(active);
}

function resumeSfxLoop(id: string): void {
  const active = activeLoops.get(id);
  if (!active) return;
  active.paused = false;
  applyLoopGain(active);
}

/** Lower ambience/music loops while narrator speech plays. */
export function setSpeechDucking(active: boolean): void {
  speechDucked = active;
  applyAllLoopGains();
}

export function endSpeechDucking(): void {
  setSpeechDucking(false);
}

/** Mute ambience loops while TTS is paused (keeps sources for seamless resume). */
export function pauseAllSfxLoops(): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  for (const active of activeLoops.values()) {
    if (active.paused) continue;
    active.paused = true;
    active.gain.gain.setValueAtTime(0, audioCtx.currentTime);
  }
}

/** Restore ambience loops after TTS resume. */
export function resumeAllSfxLoops(): void {
  void ensureContextRunning();
  for (const id of activeLoops.keys()) {
    resumeSfxLoop(id);
  }
}

export function hasActiveAmbienceLoops(): boolean {
  return activeLoops.size > 0;
}

export function stopSfxLoop(id: string): void {
  const active = activeLoops.get(id);
  if (!active) return;
  try {
    active.source.stop();
  } catch {
    /* already stopped */
  }
  activeLoops.delete(id);
}

export function stopAllSfx(): void {
  for (const id of [...activeLoops.keys()]) {
    stopSfxLoop(id);
  }
  speechDucked = false;
}

/** Start/stop loop beds to match scene (ambience + music). */
export async function syncSceneLoops(loopIds: string[]): Promise<void> {
  await ensureContextRunning();
  const want = new Set(loopIds);
  for (const id of [...activeLoops.keys()]) {
    if (!want.has(id)) stopSfxLoop(id);
  }
  for (const id of loopIds) {
    const entry = getSfxEntry(id);
    if (entry?.loop) await startLoop(entry);
  }
}

export async function playOneShots(ids: string[]): Promise<void> {
  await ensureContextRunning();
  for (const id of ids) {
    const entry = getSfxEntry(id);
    if (entry && !entry.loop) await playSfx(id);
  }
}

/** Legacy: play tag list (loops + one-shots). Prefer syncSceneLoops + playOneShots. */
export async function playSfxForTags(tagIds: string[]): Promise<void> {
  const loops: string[] = [];
  const shots: string[] = [];
  for (const id of tagIds) {
    const entry = getSfxEntry(id);
    if (!entry) continue;
    if (entry.loop) loops.push(id);
    else shots.push(id);
  }
  await syncSceneLoops(loops);
  await playOneShots(shots);
}

export async function playTurnSoundscape(args: {
  ambient: string[];
  music: string | null;
  oneShots: string[];
  resumeLoops?: boolean;
}): Promise<void> {
  const loops = [...args.ambient];
  if (args.music) loops.push(args.music);

  if (args.resumeLoops && hasActiveAmbienceLoops()) {
    resumeAllSfxLoops();
  } else {
    await syncSceneLoops(loops);
  }
  await playOneShots(args.oneShots);
}

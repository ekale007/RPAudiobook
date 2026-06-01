import { getSfxEntry, type SfxEntry } from "@/lib/audio/sfxCatalog";

type ActiveLoop = {
  id: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
};

let ctx: AudioContext | null = null;
const activeLoops = new Map<string, ActiveLoop>();

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
  if (activeLoops.has(entry.id)) return;
  const audioCtx = getContext();
  if (!audioCtx) return;
  const buffer = await loadBuffer(entry);
  if (!buffer) return;

  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  gain.gain.value = entry.volume;
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
  activeLoops.set(entry.id, { id: entry.id, source, gain });
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
}

/** Play tags from turn text; loops persist until stopAllSfx. */
export async function playSfxForTags(tagIds: string[]): Promise<void> {
  for (const id of tagIds) {
    await playSfx(id);
  }
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = Array.from({ length: numChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i] ?? 0));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return wav;
}

/** Merge multiple TTS blobs into one playable file (WAV when Web Audio is available). */
export async function concatAudioBlobs(blobs: Blob[]): Promise<Blob> {
  if (!blobs.length) return new Blob([], { type: "audio/mpeg" });
  if (blobs.length === 1) return blobs[0];
  if (typeof window === "undefined" || !("AudioContext" in window)) {
    const type = blobs[0]?.type || "audio/mpeg";
    return new Blob(blobs, { type });
  }

  const Ctx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) {
    const type = blobs[0]?.type || "audio/mpeg";
    return new Blob(blobs, { type });
  }

  const decodeCtx = new Ctx();
  try {
    const decoded: AudioBuffer[] = [];
    for (const b of blobs) {
      const ab = await b.arrayBuffer();
      decoded.push(await decodeCtx.decodeAudioData(ab.slice(0)));
    }
    if (!decoded.length) return new Blob([], { type: "audio/wav" });

    const sampleRate = decoded[0].sampleRate;
    const channels = Math.max(...decoded.map((d) => d.numberOfChannels));
    const totalDuration = decoded.reduce((sum, d) => sum + d.duration, 0);
    const totalFrames = Math.max(1, Math.ceil(totalDuration * sampleRate));

    const offline = new OfflineAudioContext(channels, totalFrames, sampleRate);
    let offset = 0;
    for (const buf of decoded) {
      const src = offline.createBufferSource();
      src.buffer = buf;
      src.connect(offline.destination);
      src.start(offset);
      offset += buf.duration;
    }

    const rendered = await offline.startRendering();
    const wav = audioBufferToWav(rendered);
    return new Blob([wav], { type: "audio/wav" });
  } catch {
    const type = blobs[0]?.type || "audio/mpeg";
    return new Blob(blobs, { type });
  } finally {
    await decodeCtx.close().catch(() => undefined);
  }
}

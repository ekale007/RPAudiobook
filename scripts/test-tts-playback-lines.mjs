import {
  activeLineIndexForProgress,
  splitTextIntoPlaybackLines,
} from "../src/lib/tts/ttsPlaybackLines.ts";

const lines = splitTextIntoPlaybackLines(
  "Erste Zeile.\n\nZweite Zeile mit mehr Text.\nDritte Zeile.",
);
if (lines.length !== 3) {
  throw new Error(`expected 3 lines, got ${lines.length}`);
}
if (activeLineIndexForProgress(lines, 0) !== 0) {
  throw new Error("progress 0 should be line 0");
}
if (activeLineIndexForProgress(lines, 0.99) !== 2) {
  throw new Error("progress 0.99 should be last line");
}

const one = splitTextIntoPlaybackLines("Ein Satz. Noch einer. Und ein dritter.");
if (one.length < 2) {
  throw new Error("single block should split by sentences");
}

console.log("ttsPlaybackLines ok", lines.length, one.length);

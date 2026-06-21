import {
  activeWordTokenIndexForProgress,
  tokenizeTextForPlayback,
} from "../src/lib/tts/ttsPlaybackLines.ts";

const text = "Er sagte hallo. Dann ging er weiter.";
const tokens = tokenizeTextForPlayback(text);
if (tokens.filter((t) => t.isWord).length < 4) {
  throw new Error("expected multiple words");
}
const mid = activeWordTokenIndexForProgress(tokens, 0.5);
const wordAtMid = tokens[mid]?.text ?? "";
if (!wordAtMid) throw new Error("no word at mid progress");

console.log("ttsPlaybackWords ok", tokens.length, "mid@", wordAtMid);

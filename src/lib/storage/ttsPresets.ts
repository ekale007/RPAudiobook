/** Local TTS server presets — same HTTP API: POST /speak { text, voice } */
export type LocalTtsEngine = "edge" | "kokoro" | "qwen" | "custom";

export const LOCAL_TTS_PRESETS: Record<
  Exclude<LocalTtsEngine, "custom">,
  { label: string; serverUrl: string; defaultVoice: string; docs: string }
> = {
  edge: {
    label: "edge-tts (free, built-in)",
    serverUrl: "http://127.0.0.1:5123",
    defaultVoice: "en-US-AndrewNeural",
    docs: "npm run tts:server",
  },
  kokoro: {
    label: "Kokoro-82M (local GPU/CPU)",
    serverUrl: "http://127.0.0.1:5124",
    defaultVoice: "af_bella",
    docs: "npm run tts:kokoro",
  },
  qwen: {
    label: "Qwen3-TTS (GPU, voice design)",
    serverUrl: "http://127.0.0.1:5125",
    defaultVoice: "Ryan",
    docs: "npm run tts:qwen",
  },
};

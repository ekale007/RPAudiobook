/** Preset voices per OpenRouter TTS model (static catalogs). */

export type OpenRouterTtsVoiceEntry = {
  id: string;
  label: string;
  group: string;
};

const KOKORO_VOICES: OpenRouterTtsVoiceEntry[] = [
  { id: "af_heart", label: "Heart", group: "EN-US · weiblich" },
  { id: "af_alloy", label: "Alloy", group: "EN-US · weiblich" },
  { id: "af_aoede", label: "Aoede", group: "EN-US · weiblich" },
  { id: "af_bella", label: "Bella", group: "EN-US · weiblich" },
  { id: "af_jessica", label: "Jessica", group: "EN-US · weiblich" },
  { id: "af_kore", label: "Kore", group: "EN-US · weiblich" },
  { id: "af_nicole", label: "Nicole", group: "EN-US · weiblich" },
  { id: "af_nova", label: "Nova", group: "EN-US · weiblich" },
  { id: "af_river", label: "River", group: "EN-US · weiblich" },
  { id: "af_sarah", label: "Sarah", group: "EN-US · weiblich" },
  { id: "af_sky", label: "Sky", group: "EN-US · weiblich" },
  { id: "am_adam", label: "Adam", group: "EN-US · männlich" },
  { id: "am_echo", label: "Echo", group: "EN-US · männlich" },
  { id: "am_eric", label: "Eric", group: "EN-US · männlich" },
  { id: "am_fenrir", label: "Fenrir", group: "EN-US · männlich" },
  { id: "am_liam", label: "Liam", group: "EN-US · männlich" },
  { id: "am_michael", label: "Michael", group: "EN-US · männlich" },
  { id: "am_onyx", label: "Onyx", group: "EN-US · männlich" },
  { id: "am_puck", label: "Puck", group: "EN-US · männlich" },
  { id: "am_santa", label: "Santa", group: "EN-US · männlich" },
  { id: "bf_alice", label: "Alice", group: "EN-GB · weiblich" },
  { id: "bf_emma", label: "Emma", group: "EN-GB · weiblich" },
  { id: "bf_isabella", label: "Isabella", group: "EN-GB · weiblich" },
  { id: "bf_lily", label: "Lily", group: "EN-GB · weiblich" },
  { id: "bm_daniel", label: "Daniel", group: "EN-GB · männlich" },
  { id: "bm_fable", label: "Fable", group: "EN-GB · männlich" },
  { id: "bm_george", label: "George", group: "EN-GB · männlich" },
  { id: "bm_lewis", label: "Lewis", group: "EN-GB · männlich" },
  { id: "ef_dora", label: "Dora", group: "Spanisch" },
  { id: "em_alex", label: "Alex", group: "Spanisch" },
  { id: "em_santa", label: "Santa", group: "Spanisch" },
  { id: "ff_siwis", label: "Siwis", group: "Französisch" },
  { id: "hf_alpha", label: "Alpha", group: "Hindi · weiblich" },
  { id: "hf_beta", label: "Beta", group: "Hindi · weiblich" },
  { id: "hm_omega", label: "Omega", group: "Hindi · männlich" },
  { id: "hm_psi", label: "Psi", group: "Hindi · männlich" },
  { id: "if_sara", label: "Sara", group: "Italienisch" },
  { id: "im_nicola", label: "Nicola", group: "Italienisch" },
  { id: "jf_alpha", label: "Alpha", group: "Japanisch · weiblich" },
  { id: "jf_gongitsune", label: "Gongitsune", group: "Japanisch · weiblich" },
  { id: "jf_nezumi", label: "Nezumi", group: "Japanisch · weiblich" },
  { id: "jf_tebukuro", label: "Tebukuro", group: "Japanisch · weiblich" },
  { id: "jm_kumo", label: "Kumo", group: "Japanisch · männlich" },
  { id: "pf_dora", label: "Dora", group: "Portugiesisch" },
  { id: "pm_alex", label: "Alex", group: "Portugiesisch" },
  { id: "pm_santa", label: "Santa", group: "Portugiesisch" },
  { id: "zf_xiaobei", label: "Xiaobei", group: "Chinesisch · weiblich" },
  { id: "zf_xiaoni", label: "Xiaoni", group: "Chinesisch · weiblich" },
  { id: "zf_xiaoxiao", label: "Xiaoxiao", group: "Chinesisch · weiblich" },
  { id: "zm_yunjian", label: "Yunjian", group: "Chinesisch · männlich" },
  { id: "zm_yunyang", label: "Yunyang", group: "Chinesisch · männlich" },
  { id: "zm_yunxi", label: "Yunxi", group: "Chinesisch · männlich" },
  { id: "zm_yunye", label: "Yunye", group: "Chinesisch · männlich" },
];

const GEMINI_VOICES: OpenRouterTtsVoiceEntry[] = [
  { id: "Achernar", label: "Achernar", group: "Gemini" },
  { id: "Achird", label: "Achird", group: "Gemini" },
  { id: "Algenib", label: "Algenib", group: "Gemini" },
  { id: "Algieba", label: "Algieba", group: "Gemini" },
  { id: "Alnilam", label: "Alnilam", group: "Gemini" },
  { id: "Aoede", label: "Aoede", group: "Gemini" },
  { id: "Autonoe", label: "Autonoe", group: "Gemini" },
  { id: "Callirrhoe", label: "Callirrhoe", group: "Gemini" },
  { id: "Charon", label: "Charon", group: "Gemini" },
  { id: "Despina", label: "Despina", group: "Gemini" },
  { id: "Enceladus", label: "Enceladus", group: "Gemini" },
  { id: "Erinome", label: "Erinome", group: "Gemini" },
  { id: "Fenrir", label: "Fenrir", group: "Gemini" },
  { id: "Gacrux", label: "Gacrux", group: "Gemini" },
  { id: "Iapetus", label: "Iapetus", group: "Gemini" },
  { id: "Kore", label: "Kore", group: "Gemini" },
  { id: "Laomedeia", label: "Laomedeia", group: "Gemini" },
  { id: "Leda", label: "Leda", group: "Gemini" },
  { id: "Orus", label: "Orus", group: "Gemini" },
  { id: "Puck", label: "Puck", group: "Gemini" },
  { id: "Pulcherrima", label: "Pulcherrima", group: "Gemini" },
  { id: "Rasalgethi", label: "Rasalgethi", group: "Gemini" },
  { id: "Sadachbia", label: "Sadachbia", group: "Gemini" },
  { id: "Sadaltager", label: "Sadaltager", group: "Gemini" },
  { id: "Schedar", label: "Schedar", group: "Gemini" },
  { id: "Sulafat", label: "Sulafat", group: "Gemini" },
  { id: "Umbriel", label: "Umbriel", group: "Gemini" },
  { id: "Vindemiatrix", label: "Vindemiatrix", group: "Gemini" },
  { id: "Zephyr", label: "Zephyr", group: "Gemini" },
  { id: "Zubenelgenubi", label: "Zubenelgenubi", group: "Gemini" },
];

const VOXTRAL_VOICES: OpenRouterTtsVoiceEntry[] = [
  { id: "alloy", label: "Alloy", group: "Voxtral" },
  { id: "echo", label: "Echo", group: "Voxtral" },
  { id: "fable", label: "Fable", group: "Voxtral" },
  { id: "onyx", label: "Onyx", group: "Voxtral" },
  { id: "nova", label: "Nova", group: "Voxtral" },
  { id: "shimmer", label: "Shimmer", group: "Voxtral" },
];

export const OPENROUTER_TTS_VOICES_BY_MODEL: Record<string, OpenRouterTtsVoiceEntry[]> =
  {
    "hexgrad/kokoro-82m": KOKORO_VOICES,
    "google/gemini-3.1-flash-tts-preview": GEMINI_VOICES,
    "mistralai/voxtral-mini-tts-2603": VOXTRAL_VOICES,
  };

export function openRouterTtsVoicesForModel(
  model?: string | null,
): OpenRouterTtsVoiceEntry[] {
  const id = model?.trim() || "hexgrad/kokoro-82m";
  return OPENROUTER_TTS_VOICES_BY_MODEL[id] ?? KOKORO_VOICES;
}

export function openRouterTtsVoiceGroups(
  model?: string | null,
): Array<{ group: string; voices: OpenRouterTtsVoiceEntry[] }> {
  const voices = openRouterTtsVoicesForModel(model);
  const order: string[] = [];
  const map = new Map<string, OpenRouterTtsVoiceEntry[]>();
  for (const v of voices) {
    if (!map.has(v.group)) {
      map.set(v.group, []);
      order.push(v.group);
    }
    map.get(v.group)!.push(v);
  }
  return order.map((group) => ({ group, voices: map.get(group)! }));
}

export function isKnownOpenRouterTtsVoice(
  model: string | undefined | null,
  voice?: string | null,
): boolean {
  const trimmed = voice?.trim();
  if (!trimmed) return false;
  return openRouterTtsVoicesForModel(model).some((v) => v.id === trimmed);
}

export function defaultOpenRouterTtsVoice(model?: string | null): string {
  const voices = openRouterTtsVoicesForModel(model);
  if (model?.includes("gemini")) return "Kore";
  if (model?.includes("voxtral")) return "alloy";
  return voices.find((v) => v.id === "af_bella")?.id ?? voices[0]?.id ?? "af_bella";
}

/** Kokoro-82M voices — full catalog from the official kokoro.js voice files. */
export type KokoroVoiceMeta = {
  id: string;
  label: string;
  hint: string;
  language: string;
  gender: "female" | "male";
};

export const KOKORO_VOICES: KokoroVoiceMeta[] = [
  { id: "af_alloy", label: "Alloy", hint: "English (US) · weiblich", language: "en-us", gender: "female" },
  { id: "af_aoede", label: "Aoede", hint: "English (US) · weiblich", language: "en-us", gender: "female" },
  { id: "af_bella", label: "Bella", hint: "English (US) · weiblich", language: "en-us", gender: "female" },
  { id: "af_heart", label: "Heart", hint: "English (US) · weiblich", language: "en-us", gender: "female" },
  { id: "af_jessica", label: "Jessica", hint: "English (US) · weiblich", language: "en-us", gender: "female" },
  { id: "af_kore", label: "Kore", hint: "English (US) · weiblich", language: "en-us", gender: "female" },
  { id: "af_nicole", label: "Nicole", hint: "English (US) · weiblich", language: "en-us", gender: "female" },
  { id: "af_nova", label: "Nova", hint: "English (US) · weiblich", language: "en-us", gender: "female" },
  { id: "af_river", label: "River", hint: "English (US) · weiblich", language: "en-us", gender: "female" },
  { id: "af_sarah", label: "Sarah", hint: "English (US) · weiblich", language: "en-us", gender: "female" },
  { id: "af_sky", label: "Sky", hint: "English (US) · weiblich", language: "en-us", gender: "female" },
  { id: "am_adam", label: "Adam", hint: "English (US) · männlich", language: "en-us", gender: "male" },
  { id: "am_echo", label: "Echo", hint: "English (US) · männlich", language: "en-us", gender: "male" },
  { id: "am_eric", label: "Eric", hint: "English (US) · männlich", language: "en-us", gender: "male" },
  { id: "am_fenrir", label: "Fenrir", hint: "English (US) · männlich", language: "en-us", gender: "male" },
  { id: "am_liam", label: "Liam", hint: "English (US) · männlich", language: "en-us", gender: "male" },
  { id: "am_michael", label: "Michael", hint: "English (US) · männlich", language: "en-us", gender: "male" },
  { id: "am_onyx", label: "Onyx", hint: "English (US) · männlich", language: "en-us", gender: "male" },
  { id: "am_puck", label: "Puck", hint: "English (US) · männlich", language: "en-us", gender: "male" },
  { id: "am_santa", label: "Santa", hint: "English (US) · männlich", language: "en-us", gender: "male" },
  { id: "bf_alice", label: "Alice", hint: "English (UK) · weiblich", language: "en-gb", gender: "female" },
  { id: "bf_emma", label: "Emma", hint: "English (UK) · weiblich", language: "en-gb", gender: "female" },
  { id: "bf_isabella", label: "Isabella", hint: "English (UK) · weiblich", language: "en-gb", gender: "female" },
  { id: "bf_lily", label: "Lily", hint: "English (UK) · weiblich", language: "en-gb", gender: "female" },
  { id: "bm_daniel", label: "Daniel", hint: "English (UK) · männlich", language: "en-gb", gender: "male" },
  { id: "bm_fable", label: "Fable", hint: "English (UK) · männlich", language: "en-gb", gender: "male" },
  { id: "bm_george", label: "George", hint: "English (UK) · männlich", language: "en-gb", gender: "male" },
  { id: "bm_lewis", label: "Lewis", hint: "English (UK) · männlich", language: "en-gb", gender: "male" },
  { id: "ef_dora", label: "EF_DORA", hint: "Spanish · weiblich", language: "es-es", gender: "female" },
  { id: "em_alex", label: "EM_ALEX", hint: "Spanish · männlich", language: "es-es", gender: "male" },
  { id: "em_santa", label: "EM_SANTA", hint: "Spanish · männlich", language: "es-es", gender: "male" },
  { id: "ff_siwis", label: "Siwis", hint: "German · weiblich", language: "de-de", gender: "female" },
  { id: "hf_alpha", label: "HF_ALPHA", hint: "Hindi · weiblich", language: "hi-in", gender: "female" },
  { id: "hf_beta", label: "HF_BETA", hint: "Hindi · weiblich", language: "hi-in", gender: "female" },
  { id: "hm_omega", label: "HM_OMEGA", hint: "Hindi · männlich", language: "hi-in", gender: "male" },
  { id: "hm_psi", label: "HM_PSI", hint: "Hindi · männlich", language: "hi-in", gender: "male" },
  { id: "if_sara", label: "IF_SARA", hint: "Italian · weiblich", language: "it-it", gender: "female" },
  { id: "im_nicola", label: "IM_NICOLA", hint: "Italian · männlich", language: "it-it", gender: "male" },
  { id: "jf_alpha", label: "JF_ALPHA", hint: "Japanese · weiblich", language: "ja-jp", gender: "female" },
  { id: "jf_gongitsune", label: "JF_GONGITSUNE", hint: "Japanese · weiblich", language: "ja-jp", gender: "female" },
  { id: "jf_nezumi", label: "JF_NEZUMI", hint: "Japanese · weiblich", language: "ja-jp", gender: "female" },
  { id: "jf_tebukuro", label: "JF_TEBUKURO", hint: "Japanese · weiblich", language: "ja-jp", gender: "female" },
  { id: "jm_kumo", label: "JM_KUMO", hint: "Japanese · männlich", language: "ja-jp", gender: "male" },
  { id: "pf_dora", label: "PF_DORA", hint: "Portuguese · weiblich", language: "pt-br", gender: "female" },
  { id: "pm_alex", label: "PM_ALEX", hint: "Portuguese · männlich", language: "pt-br", gender: "male" },
  { id: "pm_santa", label: "PM_SANTA", hint: "Portuguese · männlich", language: "pt-br", gender: "male" },
  { id: "zf_xiaobei", label: "ZF_XIAOBEI", hint: "Chinese · weiblich", language: "zh-cn", gender: "female" },
  { id: "zf_xiaoni", label: "ZF_XIAONI", hint: "Chinese · weiblich", language: "zh-cn", gender: "female" },
  { id: "zf_xiaoxiao", label: "ZF_XIAOXIAO", hint: "Chinese · weiblich", language: "zh-cn", gender: "female" },
  { id: "zf_xiaoyi", label: "ZF_XIAOYI", hint: "Chinese · weiblich", language: "zh-cn", gender: "female" },
  { id: "zm_yunjian", label: "ZM_YUNJIAN", hint: "Chinese · männlich", language: "zh-cn", gender: "male" },
  { id: "zm_yunxi", label: "ZM_YUNXI", hint: "Chinese · männlich", language: "zh-cn", gender: "male" },
  { id: "zm_yunxia", label: "ZM_YUNXIA", hint: "Chinese · männlich", language: "zh-cn", gender: "male" },
  { id: "zm_yunyang", label: "ZM_YUNYANG", hint: "Chinese · männlich", language: "zh-cn", gender: "male" },
];

export const KOKORO_PREVIEW_TEXT =
  "Hello. I will narrate your story.";

import type { StoryPlotState } from "@/lib/memory/plotState";

/** Pickable delivery / mood hints (English works best for Qwen instruct). */
export type QwenInstructPreset = {
  id: string;
  label: string;
  instruct: string;
  group: "narrator" | "dialogue" | "emotion" | "scene";
};

export const QWEN_INSTRUCT_PRESETS: QwenInstructPreset[] = [
  {
    id: "neutral",
    label: "Neutral",
    instruct:
      "Clear, natural audiobook narration. Steady pace, easy to follow.",
    group: "narrator",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    instruct:
      "Immersive third-person narration, cinematic but not overdramatic. Paint the scene with calm confidence.",
    group: "narrator",
  },
  {
    id: "intimate",
    label: "Intim",
    instruct:
      "Close, intimate narration as if speaking softly to one listener in a quiet room.",
    group: "narrator",
  },
  {
    id: "tense",
    label: "Spannung",
    instruct:
      "Quiet, suspenseful tone. Low volume, measured pacing, hold tension between phrases.",
    group: "scene",
  },
  {
    id: "dread",
    label: "Unheimlich",
    instruct:
      "Uneasy, ominous delivery. Slow pace, slight pause before key words, sense of dread.",
    group: "scene",
  },
  {
    id: "urgent",
    label: "Dringend",
    instruct:
      "Urgent, tense delivery. Faster pace, sharper attacks, controlled breathlessness.",
    group: "scene",
  },
  {
    id: "aftermath",
    label: "Nach dem Schock",
    instruct:
      "Exhausted, subdued narration. Slower pace, fragile calm after danger.",
    group: "scene",
  },
  {
    id: "warm",
    label: "Warm",
    instruct: "Warm, gentle tone. Soft consonants, caring and reassuring.",
    group: "emotion",
  },
  {
    id: "cold",
    label: "Kühl",
    instruct:
      "Cool, restrained delivery. Emotional distance, precise diction, minimal warmth.",
    group: "emotion",
  },
  {
    id: "bitter",
    label: "Bitter",
    instruct:
      "Dry, bitter undertone. Controlled sarcasm without shouting.",
    group: "emotion",
  },
  {
    id: "hopeful",
    label: "Hoffnung",
    instruct:
      "Quietly hopeful tone. Light lift at phrase endings, restrained optimism.",
    group: "emotion",
  },
  {
    id: "dialogue-calm",
    label: "Dialog ruhig",
    instruct:
      "Natural conversational speech. Mid pace, clear articulation, not theatrical.",
    group: "dialogue",
  },
  {
    id: "whisper",
    label: "Geflüstert",
    instruct:
      "Soft whisper-like delivery. Very close mic feel, barely above a whisper.",
    group: "dialogue",
  },
  {
    id: "angry",
    label: "Wütend",
    instruct:
      "Sharp, forceful speech. Clipped phrases, controlled anger, no screaming.",
    group: "dialogue",
  },
  {
    id: "playful",
    label: "Verspielt",
    instruct:
      "Light, playful tone. Slight smile in the voice, quick but clear.",
    group: "dialogue",
  },
  {
    id: "defiant",
    label: "Trotzig",
    instruct:
      "Defiant, firm delivery. Steady volume, chin-up energy, refuses to yield.",
    group: "dialogue",
  },
  {
    id: "rain",
    label: "Regen",
    instruct:
      "Soft narration with implied rain. Intimate, slightly muffled, unhurried.",
    group: "scene",
  },
  {
    id: "night",
    label: "Nacht",
    instruct:
      "Nighttime narration. Slow, careful, aware of silence and small sounds.",
    group: "scene",
  },
  {
    id: "danger",
    label: "Gefahr",
    instruct:
      "Cautious, wary delivery. Eyes everywhere, hush in the voice.",
    group: "scene",
  },
];

/** Default character delivery when no custom instruct saved yet. */
export const DEFAULT_QWEN_CHARACTER_INSTRUCT: Record<string, string> = {
  narrator:
    "Clear, immersive third-person audiobook narration. Natural pacing, match the scene emotion without exaggeration. Relaxed delivery, not nasal.",
  "naya-vellen":
    "Young woman, warm and expressive. Clear diction, emotional but controlled, never shrill.",
  "kaelen-vellen":
    "Adult man, calm and steady. Protective older-brother energy, measured and trustworthy.",
  lucifer:
    "Charismatic low male voice. Smooth, charming, a hint of danger beneath politeness.",
  michael:
    "Authoritative male voice. Firm, disciplined, speaks with quiet conviction.",
  gabriel:
    "Bright female voice. Precise, observant, cool intelligence with restrained warmth.",
  "hidden-community":
    "Older, gravelly male voice. Slow pace, weight of experience, guarded warmth.",
  "tess-roth":
    "Bright young woman, theatrical and witty. Quick pace, playful sarcasm without shouting.",
};

export function defaultCharacterInstruct(slug: string): string {
  const key = slug.trim().toLowerCase();
  return (
    DEFAULT_QWEN_CHARACTER_INSTRUCT[key] ??
    DEFAULT_QWEN_CHARACTER_INSTRUCT.narrator ??
    QWEN_INSTRUCT_PRESETS.find((p) => p.id === "dialogue-calm")!.instruct
  );
}

export function instructPresetsForSlug(slug: string): QwenInstructPreset[] {
  if (slug === "narrator") {
    return QWEN_INSTRUCT_PRESETS.filter((p) => p.group !== "dialogue");
  }
  return QWEN_INSTRUCT_PRESETS.filter((p) => p.group !== "narrator");
}

/** Auto mood from plot-state (location, threads, threats). */
const SCENE_MOOD_RULES: Array<{ pattern: RegExp; instruct: string }> = [
  {
    pattern: /regen|rain|sturm|storm|gewitter|thunder/i,
    instruct:
      "Soft narration with implied rain and wind. Intimate, unhurried, listen through the weather.",
  },
  {
    pattern: /nacht|night|dunkel|dark|mond|moon|schatten|shadow/i,
    instruct:
      "Quiet, suspenseful nighttime tone. Low and measured, respect the dark.",
  },
  {
    pattern: /kampf|fight|battle|angriff|schlag|sword|klinge/i,
    instruct:
      "Urgent, kinetic delivery. Faster pace, sharp stress, danger in motion.",
  },
  {
    pattern: /feuer|fire|flamme|burn|brand|ash/i,
    instruct:
      "Warm but anxious tone. Crackling tension, heat in the subtext.",
  },
  {
    pattern: /stadt|city|markt|street|gasse|taverne|inn|tavern/i,
    instruct:
      "Urban ambience in the voice. Slightly brisk, aware of crowds and noise.",
  },
  {
    pattern: /wald|forest|woods|nature|baum|moor|swamp/i,
    instruct:
      "Calm, earthy narration. Gentle pacing, rooted and watchful.",
  },
  {
    pattern: /schloss|castle|palast|palace|throne|temple|kirche|church|ruin/i,
    instruct:
      "Solemn, reverent undertone. Echo of stone halls, weight of history.",
  },
  {
    pattern: /höhle|cave|dungeon|kerker|prison|under/i,
    instruct:
      "Close, muffled delivery. Claustrophobic calm, danger in the walls.",
  },
  {
    pattern: /trauer|grief|funeral|tot|death|grave/i,
    instruct:
      "Subdued, respectful tone. Slow pace, grief without melodrama.",
  },
];

/** Mood from the narration passage itself (narrator segments only). */
export function sceneInstructFromNarrationText(
  text: string | null | undefined,
): string | null {
  const t = text?.trim();
  if (!t || t.length < 12) return null;
  if (
    /sunlight|sunset|kiss|smile|softens|love|warm|tender|whisper|embrace|joy|beautiful|promise|lingering|interlac/i.test(
      t,
    )
  ) {
    return "Tender, warm third-person narration. Gentle pace, intimate and hopeful, soft consonants, no nasal tone.";
  }
  if (
    /disgust|theatrical|grinning|humou?r|laugh|posterity|archives/i.test(t)
  ) {
    return "Light, amused narration. Brief playful warmth when describing comic beats, then return to calm storytelling.";
  }
  if (/proud|warmth in (his|her|their) eyes|almost like pride/i.test(t)) {
    return "Warm, observant narration. Quiet family warmth, restrained emotion.";
  }
  if (/breathes|alive with possibility|community|island hums/i.test(t)) {
    return "Expansive, hopeful closing tone. Unhurried, open cadence, sense of a wide horizon.";
  }
  return null;
}

export function sceneInstructFromPlot(
  plot: StoryPlotState | null | undefined,
): string | null {
  if (!plot) return null;
  const haystack = [
    plot.location,
    plot.timeLabel,
    ...plot.openThreads,
    ...plot.threats.filter((t) => t.status === "active").map((t) => t.label),
  ]
    .filter(Boolean)
    .join(" ");
  if (!haystack.trim()) return null;
  for (const rule of SCENE_MOOD_RULES) {
    if (rule.pattern.test(haystack)) return rule.instruct;
  }
  if (plot.threats.some((t) => t.status === "active")) {
    return "Cautious, wary narration — something threatens the scene.";
  }
  return null;
}

export function mergeInstructs(
  ...parts: Array<string | null | undefined>
): string | null {
  const unique = [
    ...new Set(parts.map((p) => p?.trim()).filter(Boolean)),
  ] as string[];
  return unique.length ? unique.join(" ") : null;
}

export function previewTextForLocale(locale: "de" | "en"): string {
  return locale === "de"
    ? "Der Regen trommelte auf das Pflaster. Etwas bewegte sich im Schatten voraus."
    : "The rain hammered the cobblestones. Something moved in the shadows ahead.";
}

/** Short lines for session-style local tests. */
export const QWEN_SESSION_SAMPLES = {
  de: {
    narrator:
      "Die Gasse war leer, bis auf das Prasseln des Regens. Elias blieb stehen und lauschte.",
    naya: "Du hättest mir sagen können, dass es gefährlich wird.",
    lucifer: "Gefahr ist nur eine andere Form von Einladung.",
  },
  en: {
    narrator:
      "The alley was empty except for the rain. Elias stopped and listened.",
    naya: "You could have told me it would be dangerous.",
    lucifer: "Danger is merely another kind of invitation.",
  },
} as const;

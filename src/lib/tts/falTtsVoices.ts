/** Static voice catalogs for fal.ai TTS endpoints. */

export type FalTtsVoiceEntry = {
  id: string;
  label: string;
  hint?: string;
};

export type FalTtsVoiceGroup = {
  group: string;
  voices: FalTtsVoiceEntry[];
};

export const FAL_KOKORO_AMERICAN_VOICES: FalTtsVoiceEntry[] = [
  { id: "af_heart", label: "Heart", hint: "warm" },
  { id: "af_alloy", label: "Alloy" },
  { id: "af_aoede", label: "Aoede" },
  { id: "af_bella", label: "Bella", hint: "narrator" },
  { id: "af_jessica", label: "Jessica" },
  { id: "af_kore", label: "Kore" },
  { id: "af_nicole", label: "Nicole" },
  { id: "af_nova", label: "Nova" },
  { id: "af_river", label: "River" },
  { id: "af_sarah", label: "Sarah" },
  { id: "af_sky", label: "Sky" },
  { id: "am_adam", label: "Adam", hint: "male" },
  { id: "am_echo", label: "Echo" },
  { id: "am_eric", label: "Eric" },
  { id: "am_fenrir", label: "Fenrir" },
  { id: "am_liam", label: "Liam" },
  { id: "am_michael", label: "Michael" },
  { id: "am_onyx", label: "Onyx" },
  { id: "am_puck", label: "Puck" },
  { id: "am_santa", label: "Santa" },
];

export const FAL_KOKORO_BRITISH_VOICES: FalTtsVoiceEntry[] = [
  { id: "bf_alice", label: "Alice" },
  { id: "bf_emma", label: "Emma" },
  { id: "bf_isabella", label: "Isabella" },
  { id: "bf_lily", label: "Lily" },
  { id: "bm_daniel", label: "Daniel" },
  { id: "bm_fable", label: "Fable" },
  { id: "bm_george", label: "George" },
  { id: "bm_lewis", label: "Lewis" },
];

/** Eleven v3 on fal — preset voice names (not ElevenLabs voice IDs). */
export const FAL_ELEVEN_V3_VOICES: FalTtsVoiceEntry[] = [
  { id: "Rachel", label: "Rachel" },
  { id: "Aria", label: "Aria" },
  { id: "Sarah", label: "Sarah" },
  { id: "Charlotte", label: "Charlotte" },
  { id: "Alice", label: "Alice" },
  { id: "Matilda", label: "Matilda" },
  { id: "Jessica", label: "Jessica" },
  { id: "Laura", label: "Laura" },
  { id: "Lily", label: "Lily" },
  { id: "George", label: "George" },
  { id: "Callum", label: "Callum" },
  { id: "Charlie", label: "Charlie" },
  { id: "Liam", label: "Liam" },
  { id: "Daniel", label: "Daniel" },
  { id: "James", label: "James" },
  { id: "Adam", label: "Adam" },
  { id: "Antoni", label: "Antoni" },
  { id: "Arnold", label: "Arnold" },
  { id: "Bill", label: "Bill" },
  { id: "Brian", label: "Brian" },
  { id: "Chris", label: "Chris" },
  { id: "Drew", label: "Drew" },
  { id: "Emily", label: "Emily" },
  { id: "Ethan", label: "Ethan" },
  { id: "Fin", label: "Fin" },
  { id: "Freya", label: "Freya" },
  { id: "Gigi", label: "Gigi" },
  { id: "Giovanni", label: "Giovanni" },
  { id: "Glinda", label: "Glinda" },
  { id: "Grace", label: "Grace" },
  { id: "Harry", label: "Harry" },
  { id: "Jeremy", label: "Jeremy" },
  { id: "Jessie", label: "Jessie" },
  { id: "Josh", label: "Josh" },
  { id: "Michael", label: "Michael" },
  { id: "Nicole", label: "Nicole" },
  { id: "Patrick", label: "Patrick" },
  { id: "Paul", label: "Paul" },
  { id: "River", label: "River" },
  { id: "Roger", label: "Roger" },
  { id: "Sam", label: "Sam" },
  { id: "Thomas", label: "Thomas" },
  { id: "Will", label: "Will" },
];

export const FAL_MINIMAX_VOICES: FalTtsVoiceEntry[] = [
  { id: "Wise_Woman", label: "Wise Woman" },
  { id: "Friendly_Person", label: "Friendly Person" },
  { id: "Deep_Voice_Man", label: "Deep Voice Man" },
  { id: "Patient_Man", label: "Patient Man" },
  { id: "Young_Man", label: "Young Man" },
  { id: "Determined_Man", label: "Determined Man" },
  { id: "Inspirational_girl", label: "Inspirational Girl" },
  { id: "Cute_Boy", label: "Cute Boy" },
  { id: "Elegant_Man", label: "Elegant Man" },
  { id: "Casual_Guy", label: "Casual Guy" },
  { id: "Lively_Girl", label: "Lively Girl" },
  { id: "Sweet_Girl", label: "Sweet Girl" },
  { id: "Calm_Woman", label: "Calm Woman" },
  { id: "Whispering_girl", label: "Whispering Girl" },
  { id: "Slothful_Man", label: "Slothful Man" },
];

const INWORLD_VOICE_IDS = [
  "Loretta (en)", "Darlene (en)", "Marlene (en)", "Hank (en)", "Evelyn (en)",
  "Celeste (en)", "Pippa (en)", "Tessa (en)", "Liam (en)", "Callum (en)",
  "Hamish (en)", "Abby (en)", "Graham (en)", "Rupert (en)", "Mortimer (en)",
  "Snik (en)", "Anjali (en)", "Saanvi (en)", "Arjun (en)", "Claire (en)",
  "Oliver (en)", "Simon (en)", "Elliot (en)", "James (en)", "Serena (en)",
  "Gareth (en)", "Vinny (en)", "Lauren (en)", "Jessica (en)", "Ethan (en)",
  "Tyler (en)", "Jason (en)", "Chloe (en)", "Veronica (en)", "Victoria (en)",
  "Miranda (en)", "Sebastian (en)", "Victor (en)", "Malcolm (en)", "Kayla (en)",
  "Nate (en)", "Jake (en)", "Brian (en)", "Amina (en)", "Kelsey (en)",
  "Derek (en)", "Grant (en)", "Evan (en)", "Alex (en)", "Ashley (en)",
  "Craig (en)", "Deborah (en)", "Dennis (en)", "Edward (en)", "Elizabeth (en)",
  "Hades (en)", "Julia (en)", "Pixie (en)", "Mark (en)", "Olivia (en)",
  "Priya (en)", "Ronald (en)", "Sarah (en)", "Shaun (en)", "Theodore (en)",
  "Timothy (en)", "Wendy (en)", "Dominus (en)", "Hana (en)", "Clive (en)",
  "Carter (en)", "Blake (en)", "Luna (en)",
  "Yichen (zh)", "Xiaoyin (zh)", "Xinyi (zh)", "Jing (zh)",
  "Erik (nl)", "Katrien (nl)", "Lennart (nl)", "Lore (nl)",
  "Alain (fr)", "Hélène (fr)", "Mathieu (fr)", "Étienne (fr)",
  "Johanna (de)", "Josef (de)",
  "Gianni (it)", "Orietta (it)",
  "Asuka (ja)", "Satoshi (ja)",
  "Hyunwoo (ko)", "Minji (ko)", "Seojun (ko)", "Yoona (ko)",
  "Szymon (pl)", "Wojciech (pl)",
  "Heitor (pt)", "Maitê (pt)",
  "Diego (es)", "Lupita (es)", "Miguel (es)", "Rafael (es)",
  "Svetlana (ru)", "Elena (ru)", "Dmitry (ru)", "Nikolai (ru)",
  "Riya (hi)", "Manoj (hi)",
  "Yael (he)", "Oren (he)",
  "Nour (ar)", "Omar (ar)",
];

function inworldLangFromId(id: string): string {
  const m = /\(([^)]+)\)\s*$/.exec(id);
  return m?.[1] ?? "other";
}

function inworldLangLabel(code: string): string {
  const labels: Record<string, string> = {
    en: "English",
    de: "Deutsch",
    fr: "Französisch",
    es: "Spanisch",
    pt: "Portugiesisch",
    it: "Italienisch",
    nl: "Niederländisch",
    pl: "Polnisch",
    ru: "Russisch",
    zh: "Chinesisch",
    ja: "Japanisch",
    ko: "Koreanisch",
    hi: "Hindi",
    he: "Hebräisch",
    ar: "Arabisch",
    other: "Weitere",
  };
  return labels[code] ?? code;
}

export function falInworldVoiceGroups(): FalTtsVoiceGroup[] {
  const byLang = new Map<string, FalTtsVoiceEntry[]>();
  for (const id of INWORLD_VOICE_IDS) {
    const lang = inworldLangFromId(id);
    const name = id.replace(/\s*\([^)]+\)\s*$/, "").trim();
    const list = byLang.get(lang) ?? [];
    list.push({ id, label: name, hint: lang });
    byLang.set(lang, list);
  }
  const order = [
    "de", "en", "fr", "es", "pt", "it", "nl", "pl", "ru",
    "zh", "ja", "ko", "hi", "he", "ar", "other",
  ];
  return order
    .filter((lang) => byLang.has(lang))
    .map((lang) => ({
      group: inworldLangLabel(lang),
      voices: byLang.get(lang)!,
    }));
}

export const FAL_PREVIEW_TEXT =
  "Hello. This is a short voice preview from fal.ai.";

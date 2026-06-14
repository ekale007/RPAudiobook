import type { StoryContentLocale } from "@/lib/story/protagonist";

const SPEECH_VERBS_EN =
  "said|says|asked|asks|replied|replies|whispered|whispers|muttered|mutters|shouted|shouts|added|adds|called|calls|continued|continues|offers|laughs|blinks|speaks|spoke|snorts|snorted|growls|growled|grumbles|grumbled|clears|cut in|cuts in";

const SPEECH_VERBS_DE =
  "sagte|sagt|sagten|fragte|fragt|flüsterte|flüstert|murmelte|murmelt|rief|ruft|antwortete|antwortet|erwiderte|erwidert|fuhr fort|fährt fort|setzte hinzu|nickte|lachte|lacht|meinte|meint|erklärte|erklärt|bestätigte|bestätigt|begann|beginnt";

export function speechVerbsPattern(locale: StoryContentLocale): string {
  return locale === "de"
    ? `${SPEECH_VERBS_EN}|${SPEECH_VERBS_DE}`
    : SPEECH_VERBS_EN;
}

export function speechActPattern(locale: StoryContentLocale): RegExp {
  if (locale === "de") {
    return /\b(sie|er)\s+(neckt|sagte|sagt|flüsterte|flüstert|murmelte|murmelt|fügt hinzu|fügte hinzu|lachte|lacht|nickte|nickt|meinte|meint)\b/i;
  }
  return /\b(she|he)\s+(teases|teased|says|said|whispers|whispered|murmurs|murmured|adds|added|continues|continued|laughs|laughed)\b/i;
}

export function genderedActionPattern(locale: StoryContentLocale): RegExp {
  if (locale === "de") {
    return /\b(sie|er)\s+(drückt|dreht|hält inne|blickt|schaut|tritt|geht|atmet|lacht|lächelt|nickt|schüttelt|wartet|zögert)\b/i;
  }
  return /\b(she|he)\s+(?:squeezes|turns|pauses|glances|looks|heads|steps|walks|exhales|laughs|smiles|nods|shakes|watches|waits)\b/i;
}

export function protagonistBeatBeforePattern(
  locale: StoryContentLocale,
): RegExp {
  if (locale === "de") {
    return /\bDu\s+(sagst|fragst|nickst|lächelst|lachst|blickst|siehst|drehst|zögerst|flüsterst|murmelst|rufst|antwortest|bestätigst)\b/i;
  }
  return /\bYou\s+(shrug|say|ask|pull|look|turn|nod|smile|laugh|pause|dial|confirm|kneel|switch|glance|bounce|feel|cut in)\b/i;
}

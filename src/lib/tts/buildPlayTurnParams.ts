import type { CharacterRow } from "@/lib/db/stories";
import type { PlayAssistantTurnParams } from "@/lib/tts/playAssistantTurnAudio";
import { preprocessAssistantMarkup, stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import type { VoiceEnabledSlugs } from "@/lib/tts/voiceActivation";
import type { StorySettings, VoiceMap } from "@/lib/types";

type TurnLike = {
  id: string;
  content: string;
  speaker_slug?: string | null;
};

export function buildPlayTurnParams(
  turn: TurnLike,
  ctx: {
    voiceMap?: VoiceMap;
    voiceEnabledSlugs?: VoiceEnabledSlugs;
    cast?: CharacterRow[];
    storyLocale?: string;
    storySettings?: StorySettings;
    segmentOverrides?: Record<string, string>;
  },
): PlayAssistantTurnParams {
  const raw = turn.content;
  const text =
    stripSpeakerTags(preprocessAssistantMarkup(raw)).trim() || raw.trim();
  return {
    turnId: turn.id,
    text,
    rawContent: raw,
    speakerSlug: turn.speaker_slug,
    voiceMap: ctx.voiceMap,
    voiceEnabledSlugs: ctx.voiceEnabledSlugs,
    cast: ctx.cast,
    storyLocale: ctx.storyLocale,
    storySettings: ctx.storySettings,
    segmentOverrides: ctx.segmentOverrides,
  };
}

/** WryTour / flat character card export */
export interface WryTourCharacter {
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  tags?: string[];
  creator?: string;
  character_version?: string;
  extensions?: Record<string, unknown>;
}

export interface LoreEntry {
  keys: string[];
  content: string;
  comment?: string;
  order?: number;
  position?: number;
  enabled?: boolean;
  constant?: boolean;
}

export interface WryTourLorebook {
  name: string;
  description?: string;
  entries: LoreEntry[];
}

export type TurnRole = "user" | "assistant" | "system";

export interface ChatTurn {
  role: TurnRole;
  content: string;
  speakerSlug?: string | null;
}

export interface OpenRouterSettings {
  apiKey: string;
  model: string;
  /** Optional override for storyteller chat generation. */
  narratorModel?: string;
  maxTokens: number;
  temperature: number;
}

export const DEFAULT_OPENROUTER: Omit<OpenRouterSettings, "apiKey"> = {
  model: "google/gemini-2.5-flash-lite",
  narratorModel: "aion-labs/aion-2.0",
  maxTokens: 2048,
  temperature: 0.85,
};

/** slug → Kokoro voice id or ElevenLabs voice id */
export type VoiceMap = Record<string, string>;

import type { StoryPlotState } from "@/lib/memory/plotState";
import type { StoryPin } from "@/lib/memory/storyPins";

/** Qwen3-TTS voice profile per cast slug (see docs/QWEN-MASTERPLAN.md). */
export type QwenVoiceProfile = {
  slug: string;
  mode: "preset" | "design" | "clone";
  presetSpeaker?: string;
  designInstruct?: string;
  language?: string;
  updatedAt?: string;
};

export type StoryProtagonistProfile = {
  displayName: string;
  /** de: du | sie | er — en: you | they */
  pronouns: "du" | "sie" | "er" | "you" | "they";
  gender?: "female" | "male" | "neutral";
};

export interface StorySettings {
  recentTurnCount: number;
  loreTokenBudget: number;
  voiceMap?: VoiceMap;
  /** Player character — separate TTS slug `protagonist`. */
  protagonist?: StoryProtagonistProfile;
  /** Per-slug Qwen instruct + preset when provider is qwen. */
  qwenVoiceProfiles?: Record<string, QwenVoiceProfile>;
  /** Auto mood from plot-state (location, threats). Default on. */
  qwenSceneInstructEnabled?: boolean;
  /** Cast slugs that use their own voice; others use narrator. Omit = all cast enabled. */
  voiceEnabledSlugs?: string[];
  /** Structured RP memory (threats, time, resolved facts) — overrides stale countdowns */
  plotState?: StoryPlotState | null;
  /** Player-pinned facts for the narrator */
  pinnedNotes?: StoryPin[];
}

export const DEFAULT_STORY_SETTINGS: StorySettings = {
  recentTurnCount: 24,
  loreTokenBudget: 3500,
};

/** Interactive story character card (JSON import/export). */
export interface StoryCharacterCard {
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

export interface StoryLorebook {
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

import type { StorySoundscape } from "@/lib/audio/soundscape";
import type { TtsProvider } from "@/lib/storage/ttsSettings";
import type { StoryPlotState } from "@/lib/memory/plotState";
import type { StoryPin } from "@/lib/memory/storyPins";
import type { StoryTimeline } from "@/lib/memory/storyTimeline";
import type { ReflectionsContainer } from "@/lib/memory/reflections";

/** Per-provider cast voice maps — `local-kokoro` / `local-qwen` when provider is `local`. */
export type VoiceMapStorageKey =
  | TtsProvider
  | "local-kokoro"
  | "local-qwen";

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
  /** Legacy single map — migrated into `voiceMaps` on save; kept for older clients. */
  voiceMap?: VoiceMap;
  /** Cast voices per TTS provider (and local engine split). */
  voiceMaps?: Partial<Record<VoiceMapStorageKey, VoiceMap>>;
  /** Player character — separate TTS slug `protagonist`. */
  protagonist?: StoryProtagonistProfile;
  /** Per-slug Qwen instruct + preset when provider is qwen. */
  qwenVoiceProfiles?: Record<string, QwenVoiceProfile>;
  /** Auto mood from plot-state (location, threats). Default on. */
  qwenSceneInstructEnabled?: boolean;
  /** Optional per-story sound beds (ambience loops, music, one-shots). */
  soundscape?: StorySoundscape | null;
  /** Cast slugs that use their own voice; others use narrator. Omit = all cast enabled. */
  voiceEnabledSlugs?: string[];
  /** Structured RP memory (threats, time, resolved facts) — overrides stale countdowns */
  plotState?: StoryPlotState | null;
  /** Player-pinned facts for the narrator */
  pinnedNotes?: StoryPin[];
  /** Phase 3: chronological event log used by the timeline page */
  timeline?: StoryTimeline | null;
  /** Short pitch / logline — overrides template default in prompts */
  storyConcept?: string | null;
  /** Phase 7.3: higher-level reflection layer (Diagnose Task 2B) */
  storyReflections?: ReflectionsContainer | null;
}

export const DEFAULT_STORY_SETTINGS: StorySettings = {
  recentTurnCount: 24,
  loreTokenBudget: 3500,
};

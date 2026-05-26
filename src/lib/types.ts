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
  maxTokens: number;
  temperature: number;
}

export const DEFAULT_OPENROUTER: Omit<OpenRouterSettings, "apiKey"> = {
  model: "anthropic/claude-sonnet-4",
  maxTokens: 2048,
  temperature: 0.85,
};

export type ChatMode = "narrator" | "group";

/** slug → Kokoro voice id or ElevenLabs voice id */
export type VoiceMap = Record<string, string>;

export interface StorySettings {
  recentTurnCount: number;
  loreTokenBudget: number;
  chatMode?: ChatMode;
  voiceMap?: VoiceMap;
}

export const DEFAULT_STORY_SETTINGS: StorySettings = {
  recentTurnCount: 16,
  loreTokenBudget: 3500,
  chatMode: "narrator",
};

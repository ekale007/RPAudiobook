import {
  fetchUserPreferences,
  upsertUserPreferences,
  type SyncedOpenRouterPrefs,
  type SyncedTtsPrefs,
} from "@/lib/db/userPreferences";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { DEFAULT_OPENROUTER } from "@/lib/types";
import {
  DEFAULT_TTS,
  loadTtsSettings,
  saveTtsSettings,
  type TtsSettings,
} from "@/lib/storage/ttsSettings";
import {
  loadOpenRouterSettings,
  saveOpenRouterSettings,
} from "@/lib/storage/openRouterSettings";
import type { OpenRouterSettings } from "@/lib/types";
import { isServerLlmAvailable } from "@/lib/server/serverCapabilities";

const OPENROUTER_STORAGE_KEY = "hoerbuchki.openrouter";
const TTS_STORAGE_KEY = "hoerbuchki.tts";

function hasLocalPrefsSaved(): boolean {
  try {
    return Boolean(
      localStorage.getItem(OPENROUTER_STORAGE_KEY) ||
        localStorage.getItem(TTS_STORAGE_KEY),
    );
  } catch {
    return false;
  }
}

export const PREFS_UPDATED_EVENT = "hoerbuchki:prefs-updated";

function notifyPrefsUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PREFS_UPDATED_EVENT));
  }
}

export function toSyncedOpenRouter(
  settings: OpenRouterSettings,
): SyncedOpenRouterPrefs {
  const { apiKey: _key, ...rest } = settings;
  return rest;
}

export function toSyncedTts(settings: TtsSettings): SyncedTtsPrefs {
  const { elevenLabsApiKey: _key, ...rest } = settings;
  return rest;
}

function mergeOpenRouterFromRemote(
  remote: Partial<SyncedOpenRouterPrefs>,
  local: OpenRouterSettings | null,
): OpenRouterSettings {
  return {
    ...DEFAULT_OPENROUTER,
    ...remote,
    apiKey: local?.apiKey?.trim() ?? "",
    narratorModel: remote.narratorModel?.trim() || undefined,
  };
}

function mergeTtsFromRemote(
  remote: Partial<SyncedTtsPrefs>,
  local: TtsSettings,
): TtsSettings {
  return {
    ...DEFAULT_TTS,
    ...local,
    ...remote,
    elevenLabsApiKey: local.elevenLabsApiKey?.trim() ?? "",
    pronunciationMap: {
      ...(local.pronunciationMap ?? {}),
      ...(remote.pronunciationMap ?? {}),
    },
  };
}

function hasRemoteOpenRouter(remote: Partial<SyncedOpenRouterPrefs>): boolean {
  return Boolean(
    remote.model ||
      remote.narratorModel ||
      remote.maxTokens != null ||
      remote.temperature != null,
  );
}

function hasRemoteTts(remote: Partial<SyncedTtsPrefs>): boolean {
  return Boolean(
    remote.provider ||
      remote.localEngine ||
      remote.localServerUrl ||
      remote.localVoice ||
      remote.elevenLabsVoiceId ||
      remote.elevenLabsModelId ||
      (remote.pronunciationMap &&
        Object.keys(remote.pronunciationMap).length > 0),
  );
}

export async function pushUserPreferencesToAccount(): Promise<void> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const or =
    loadOpenRouterSettings() ??
    (isServerLlmAvailable()
      ? ({ ...DEFAULT_OPENROUTER, apiKey: "" } satisfies OpenRouterSettings)
      : null);
  const tts = loadTtsSettings();

  await upsertUserPreferences(user.id, {
    open_router: toSyncedOpenRouter(
      or ?? { ...DEFAULT_OPENROUTER, apiKey: "" },
    ),
    tts: toSyncedTts(tts),
  });
}

export async function pullUserPreferencesFromAccount(): Promise<boolean> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return false;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const row = await fetchUserPreferences(user.id);
  const localOr = loadOpenRouterSettings();
  const localTts = loadTtsSettings();

  if (!row) {
    if (hasLocalPrefsSaved()) {
      await pushUserPreferencesToAccount();
    }
    return false;
  }

  let changed = false;

  if (hasRemoteOpenRouter(row.open_router)) {
    const merged = mergeOpenRouterFromRemote(row.open_router, localOr);
    saveOpenRouterSettings(merged, { sync: false });
    changed = true;
  }

  if (hasRemoteTts(row.tts)) {
    const merged = mergeTtsFromRemote(row.tts, localTts);
    saveTtsSettings(merged, { sync: false });
    changed = true;
  }

  if (changed) notifyPrefsUpdated();
  return changed;
}

export async function syncUserPreferences(): Promise<void> {
  try {
    await pullUserPreferencesFromAccount();
  } catch {
    /* offline or migration pending */
  }
}

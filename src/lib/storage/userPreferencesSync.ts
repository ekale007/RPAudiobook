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
  getTtsSettingsUpdatedAt,
  loadTtsSettings,
  normalizeTtsSettings,
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

function stripTtsSyncMeta(
  remote: Partial<SyncedTtsPrefs>,
): Partial<Omit<TtsSettings, "elevenLabsApiKey">> {
  const { updatedAt: _at, ...rest } = remote;
  return rest;
}

function shouldUseRemoteTts(
  remote: Partial<SyncedTtsPrefs>,
  rowUpdatedAt: string | null | undefined,
  localUpdatedAt: string | null,
): boolean {
  const remoteTtsAt = remote.updatedAt?.trim() || null;
  if (remoteTtsAt) {
    return !localUpdatedAt || remoteTtsAt > localUpdatedAt;
  }
  // Legacy rows without tts.updatedAt — don't let LLM-only row bumps overwrite local TTS.
  if (localUpdatedAt) return false;
  return Boolean(rowUpdatedAt?.trim());
}

function mergeTtsFromRemote(
  remote: Partial<SyncedTtsPrefs>,
  local: TtsSettings,
  useRemote: boolean,
): TtsSettings {
  const remoteFields = stripTtsSyncMeta(remote);

  const merged = useRemote
    ? {
        ...DEFAULT_TTS,
        ...remoteFields,
        elevenLabsApiKey: local.elevenLabsApiKey?.trim() ?? "",
        pronunciationMap: {
          ...(local.pronunciationMap ?? {}),
          ...(remoteFields.pronunciationMap ?? {}),
        },
      }
    : {
        ...DEFAULT_TTS,
        ...remoteFields,
        ...local,
        elevenLabsApiKey: local.elevenLabsApiKey?.trim() ?? "",
        pronunciationMap: {
          ...(remoteFields.pronunciationMap ?? {}),
          ...(local.pronunciationMap ?? {}),
        },
      };

  return normalizeTtsSettings(merged);
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
    tts: {
      ...toSyncedTts(tts),
      updatedAt: getTtsSettingsUpdatedAt() ?? new Date().toISOString(),
    },
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
    const localUpdatedAt = getTtsSettingsUpdatedAt();
    const useRemote = shouldUseRemoteTts(
      row.tts,
      row.updated_at,
      localUpdatedAt,
    );
    const merged = mergeTtsFromRemote(row.tts, localTts, useRemote);
    const remoteTtsAt = row.tts.updatedAt?.trim() || null;
    saveTtsSettings(merged, {
      sync: false,
      updatedAt: useRemote
        ? remoteTtsAt ?? row.updated_at
        : localUpdatedAt ?? undefined,
    });
    changed = true;
    if (!useRemote) {
      const remoteNorm = normalizeTtsSettings({
        ...DEFAULT_TTS,
        ...stripTtsSyncMeta(row.tts),
      });
      if (
        merged.provider !== remoteNorm.provider ||
        merged.elevenLabsVoiceId !== remoteNorm.elevenLabsVoiceId ||
        merged.elevenLabsModelId !== remoteNorm.elevenLabsModelId ||
        merged.localVoice !== remoteNorm.localVoice
      ) {
        void pushUserPreferencesToAccount();
      }
    }
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

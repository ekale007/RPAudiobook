import { createClient } from "@/lib/supabase/client";
import type { OpenRouterSettings } from "@/lib/types";
import type { TtsSettings } from "@/lib/storage/ttsSettings";

export type SyncedOpenRouterPrefs = Omit<OpenRouterSettings, "apiKey">;
export type SyncedTtsPrefs = Omit<
  TtsSettings,
  "elevenLabsApiKey" | "fishAudioApiKey"
> & {
  /** ISO timestamp of the last TTS save (not the whole prefs row). */
  updatedAt?: string;
};

export type UserPreferencesRow = {
  user_id: string;
  open_router: Partial<SyncedOpenRouterPrefs>;
  tts: Partial<SyncedTtsPrefs>;
  updated_at: string;
};

export async function fetchUserPreferences(
  userId: string,
): Promise<UserPreferencesRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("user_id, open_router, tts, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserPreferencesRow | null;
}

export async function upsertUserPreferences(
  userId: string,
  prefs: {
    open_router: SyncedOpenRouterPrefs;
    tts: SyncedTtsPrefs;
  },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      open_router: prefs.open_router,
      tts: prefs.tts,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

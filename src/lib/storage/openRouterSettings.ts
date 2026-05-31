import type { OpenRouterSettings } from "@/lib/types";

import { DEFAULT_OPENROUTER } from "@/lib/types";
import { isServerLlmAvailable } from "@/lib/server/serverCapabilities";

const STORAGE_KEY = "hoerbuchki.openrouter";

export function isLlmReady(): boolean {
  if (isServerLlmAvailable()) return true;
  const s = loadOpenRouterSettings();
  return Boolean(s?.apiKey?.trim());
}

export function loadOpenRouterSettings(): OpenRouterSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (isServerLlmAvailable()) {
        return { ...DEFAULT_OPENROUTER, apiKey: "" };
      }
      return null;
    }

    const parsed = JSON.parse(raw) as OpenRouterSettings & {
      groupModel?: string;
    };

    if (!isServerLlmAvailable() && !parsed.apiKey?.trim()) return null;

    return {
      ...DEFAULT_OPENROUTER,
      ...parsed,
      apiKey: parsed.apiKey?.trim() ?? "",
      narratorModel: parsed.narratorModel?.trim() || undefined,
    };
  } catch {
    return isServerLlmAvailable() ? { ...DEFAULT_OPENROUTER, apiKey: "" } : null;
  }
}

export function saveOpenRouterSettings(
  settings: OpenRouterSettings,
  options?: { sync?: boolean },
): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  if (options?.sync !== false && typeof window !== "undefined") {
    void import("@/lib/storage/userPreferencesSync").then((m) =>
      m.pushUserPreferencesToAccount(),
    );
  }
}

export function clearOpenRouterApiKey(): void {
  const current = loadOpenRouterSettings();
  if (current) {
    saveOpenRouterSettings({ ...current, apiKey: "" });
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/** Storyteller chat — optional narratorModel override. */
export function resolveChatModelSettings(
  settings: OpenRouterSettings,
): OpenRouterSettings {
  const override = settings.narratorModel?.trim();
  if (!override) return settings;
  return { ...settings, model: override };
}

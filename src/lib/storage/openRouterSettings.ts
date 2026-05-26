import type { OpenRouterSettings } from "@/lib/types";
import { DEFAULT_OPENROUTER } from "@/lib/types";

const STORAGE_KEY = "hoerbuchki.openrouter";

export function loadOpenRouterSettings(): OpenRouterSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OpenRouterSettings;
    if (!parsed.apiKey?.trim()) return null;
    return {
      ...DEFAULT_OPENROUTER,
      ...parsed,
      apiKey: parsed.apiKey.trim(),
    };
  } catch {
    return null;
  }
}

export function saveOpenRouterSettings(settings: OpenRouterSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearOpenRouterApiKey(): void {
  const current = loadOpenRouterSettings();
  if (current) {
    saveOpenRouterSettings({ ...current, apiKey: "" });
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

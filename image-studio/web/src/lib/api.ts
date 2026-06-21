import type { ImageFormatPreset } from "./presets";

const API = "/api";

export type Health = { ok: boolean; engine?: string; error?: string };

function serverOfflineHint(status?: number): string {
  if (status === 500 || status === 502 || status === 503) {
    return "GPU-Server nicht erreichbar. Im Ordner image-studio: npm run dev (startet Server + UI) oder npm run server.";
  }
  return "GPU-Server offline.";
}

export async function checkHealth(): Promise<Health> {
  try {
    const res = await fetch(`${API}/health`, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: text.trim() || serverOfflineHint(res.status),
      };
    }
    const json = (await res.json()) as { ok?: boolean; engine?: string };
    return { ok: Boolean(json.ok), engine: json.engine };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: msg.includes("fetch")
        ? "GPU-Server offline — npm run dev im Ordner image-studio starten."
        : msg,
    };
  }
}

export async function generateImage(opts: {
  prompt: string;
  width: number;
  height: number;
  steps: number;
  seed: number | null;
}): Promise<Blob> {
  const res = await fetch(`${API}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: opts.prompt,
      width: opts.width,
      height: opts.height,
      steps: opts.steps,
      seed: opts.seed,
    }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.blob();
}

async function readApiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: string | unknown[] };
    if (typeof j.detail === "string" && j.detail.trim()) return j.detail;
    if (Array.isArray(j.detail)) return JSON.stringify(j.detail);
  } catch {
    const t = await res.text();
    if (t.trim()) return t;
  }
  return res.statusText || `HTTP ${res.status}`;
}

export async function optimizePrompt(opts: {
  brief: string;
  preset: ImageFormatPreset;
  currentPrompt?: string;
  apiKey: string;
  model: string;
}): Promise<string> {
  const res = await fetch(`${API}/optimize-prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brief: opts.brief,
      format_label: opts.preset.label,
      format_hint: opts.preset.optimizeHint,
      width: opts.preset.width,
      height: opts.preset.height,
      current_prompt: opts.currentPrompt,
      locale: "de",
      api_key: opts.apiKey,
      model: opts.model,
    }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const json = (await res.json()) as { prompt?: string };
  if (!json.prompt?.trim()) throw new Error("Leere KI-Antwort");
  return json.prompt.trim();
}

const SETTINGS_KEY = "image-studio-settings";

export type StudioSettings = {
  openRouterKey: string;
  openRouterModel: string;
};

export function loadSettings(): StudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { openRouterKey: "", openRouterModel: "google/gemini-2.5-flash-lite" };
    return { ...JSON.parse(raw) } as StudioSettings;
  } catch {
    return { openRouterKey: "", openRouterModel: "google/gemini-2.5-flash-lite" };
  }
}

export function saveSettings(s: StudioSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

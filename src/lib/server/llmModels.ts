/** Admin-configured LLM catalog (OpenRouter model ids + estimated ¢/1k tokens).
 *  Rates: OpenRouter $/1M tokens ÷ 10 → promptCentsPer1k / completionCentsPer1k. */

export type LlmModelOption = {
  id: string;
  label: string;
  promptCentsPer1k: number;
  completionCentsPer1k: number;
};

const DEFAULT_CATALOG: LlmModelOption[] = [
  {
    id: "deepseek/deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    promptCentsPer1k: 0.0435,
    completionCentsPer1k: 0.087,
  },
  {
    id: "deepseek/deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    promptCentsPer1k: 0.0098,
    completionCentsPer1k: 0.0197,
  },
  {
    id: "qwen/qwen3.5-flash-02-23",
    label: "Qwen3.5 Flash",
    promptCentsPer1k: 0.0065,
    completionCentsPer1k: 0.026,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    promptCentsPer1k: 0.01,
    completionCentsPer1k: 0.04,
  },
  {
    id: "aion-labs/aion-2.0",
    label: "Aion 2.0",
    promptCentsPer1k: 0.08,
    completionCentsPer1k: 0.16,
  },
];

function parseCatalogEntry(raw: unknown): LlmModelOption | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const label =
    typeof o.label === "string" && o.label.trim()
      ? o.label.trim()
      : id.split("/").pop() ?? id;
  const promptCentsPer1k = Number(o.promptCentsPer1k);
  const completionCentsPer1k = Number(o.completionCentsPer1k);
  if (!id) return null;
  if (
    !Number.isFinite(promptCentsPer1k) ||
    !Number.isFinite(completionCentsPer1k) ||
    promptCentsPer1k < 0 ||
    completionCentsPer1k < 0
  ) {
    return null;
  }
  return { id, label, promptCentsPer1k, completionCentsPer1k };
}

/** Parse `BETA_LLM_MODELS` JSON array. Falls back to built-in defaults. */
export function getLlmModelCatalog(): LlmModelOption[] {
  const raw = process.env.BETA_LLM_MODELS?.trim();
  if (!raw) return DEFAULT_CATALOG;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_CATALOG;
    const models = parsed
      .map(parseCatalogEntry)
      .filter((m): m is LlmModelOption => m !== null);
    return models.length ? models : DEFAULT_CATALOG;
  } catch {
    return DEFAULT_CATALOG;
  }
}

export function getLlmModelById(modelId: string | undefined): LlmModelOption | null {
  const id = modelId?.trim();
  if (!id) return null;
  return getLlmModelCatalog().find((m) => m.id === id) ?? null;
}

/** Pick a user-requested model or the admin default / first catalog entry. */
export function resolveAllowedLlmModel(requested?: string | null): LlmModelOption {
  const catalog = getLlmModelCatalog();
  const trimmed = requested?.trim();
  if (trimmed) {
    const match = catalog.find((m) => m.id === trimmed);
    if (match) return match;
  }

  const adminDefault = process.env.OPENROUTER_MODEL?.trim();
  if (adminDefault) {
    const match = catalog.find((m) => m.id === adminDefault);
    if (match) return match;
  }

  return catalog[0];
}

export function formatModelPriceHint(model: LlmModelOption): string {
  const p = model.promptCentsPer1k.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const c = model.completionCentsPer1k.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `ca. ${p} ¢ / 1k Prompt · ${c} ¢ / 1k Antwort`;
}

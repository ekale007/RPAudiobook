"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/supabase/authFetch";
import { useServerCapabilities } from "@/lib/server/useServerCapabilities";

export type LlmModelCatalogEntry = {
  id: string;
  label: string;
  promptCentsPer1k: number;
  completionCentsPer1k: number;
  priceHint: string;
};

export function useLlmModelCatalog() {
  const { serverLlm, ready } = useServerCapabilities();
  const [models, setModels] = useState<LlmModelCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!serverLlm) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/llm/models");
      if (res.ok) {
        const json = (await res.json()) as { models: LlmModelCatalogEntry[] };
        setModels(json.models ?? []);
      }
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, [serverLlm]);

  useEffect(() => {
    if (!ready || !serverLlm) return;
    void refresh();
  }, [ready, serverLlm, refresh]);

  return { models, loading, refresh, ready: ready && serverLlm };
}

export function pickAllowedModel(
  modelId: string,
  catalog: LlmModelCatalogEntry[],
): string {
  if (catalog.some((m) => m.id === modelId)) return modelId;
  return catalog[0]?.id ?? modelId;
}

"use client";

import { useEffect, useState } from "react";
import type { LlmAttributionMap } from "@/lib/chat/dialogueAttributionLlm";
import { ensureDialogueAttribution } from "@/lib/chat/resolveDialogueAttribution";
import type { CharacterRow } from "@/lib/db/stories";

export function useDialogueAttribution(
  turnId: string,
  content: string,
  cast: CharacterRow[],
  enabled: boolean,
): LlmAttributionMap | null {
  const [llmMap, setLlmMap] = useState<LlmAttributionMap | null>(null);

  useEffect(() => {
    if (!enabled || !content.trim() || turnId.startsWith("tmp-")) {
      setLlmMap(null);
      return;
    }

    let cancelled = false;
    ensureDialogueAttribution(turnId, content, cast)
      .then((map) => {
        if (!cancelled) setLlmMap(map);
      })
      .catch(() => {
        if (!cancelled) setLlmMap(null);
      });

    return () => {
      cancelled = true;
    };
  }, [turnId, content, cast, enabled]);

  return llmMap;
}

export { prefetchDialogueAttributionBatch as prefetchDialogueAttribution } from "@/lib/chat/resolveDialogueAttribution";

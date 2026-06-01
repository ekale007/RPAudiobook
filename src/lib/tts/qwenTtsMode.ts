import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import type { TtsProvider } from "@/lib/storage/ttsSettings";
import { loadTtsSettings } from "@/lib/storage/ttsSettings";

export function isQwenTtsMode(
  provider?: TtsProvider,
  localEngine?: LocalTtsEngine,
): boolean {
  const p = provider ?? loadTtsSettings().provider;
  const engine = localEngine ?? loadTtsSettings().localEngine;
  return (
    p === "qwen" ||
    p === "qwen-cloud" ||
    (p === "local" && engine === "qwen")
  );
}

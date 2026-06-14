import type { TtsProvider } from "@/lib/storage/ttsSettings";
import { isQwenTtsMode } from "@/lib/tts/qwenTtsMode";

/** Plot/mood delivery (Fish tags, Eleven v3, Qwen instruct). */
export function supportsSceneDelivery(provider: TtsProvider): boolean {
  return (
    provider === "fish-audio" ||
    provider === "elevenlabs" ||
    isQwenTtsMode(provider)
  );
}

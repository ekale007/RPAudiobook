import { NextResponse } from "next/server";
import {
  isServerElevenLabsConfigured,
  isServerFishAudioTtsConfigured,
  isServerLlmConfigured,
  isServerOpenRouterTtsConfigured,
  isServerQwenCloudTtsConfigured,
  isServerQwenTtsConfigured,
  isServerTtsConfigured,
} from "@/lib/server/env";

export async function GET() {
  return NextResponse.json({
    serverTts: isServerTtsConfigured(),
    serverElevenLabsTts: isServerElevenLabsConfigured(),
    serverOpenRouterTts: isServerOpenRouterTtsConfigured(),
    serverFishAudioTts: isServerFishAudioTtsConfigured(),
    serverQwenTts: isServerQwenTtsConfigured(),
    serverQwenCloudTts: isServerQwenCloudTtsConfigured(),
    serverLlm: isServerLlmConfigured(),
  });
}

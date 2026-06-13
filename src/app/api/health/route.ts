import { NextResponse } from "next/server";
import {
  isServerElevenLabsConfigured,
  isServerFalTtsConfigured,
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
    serverFalTts: isServerFalTtsConfigured(),
    serverQwenTts: isServerQwenTtsConfigured(),
    serverQwenCloudTts: isServerQwenCloudTtsConfigured(),
    serverLlm: isServerLlmConfigured(),
  });
}

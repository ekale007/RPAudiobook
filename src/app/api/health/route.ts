import { NextResponse } from "next/server";
import {
  isServerElevenLabsConfigured,
  isServerLlmConfigured,
  isServerQwenCloudTtsConfigured,
  isServerQwenTtsConfigured,
  isServerTtsConfigured,
} from "@/lib/server/env";

export async function GET() {
  return NextResponse.json({
    serverTts: isServerTtsConfigured(),
    serverElevenLabsTts: isServerElevenLabsConfigured(),
    serverQwenTts: isServerQwenTtsConfigured(),
    serverQwenCloudTts: isServerQwenCloudTtsConfigured(),
    serverLlm: isServerLlmConfigured(),
  });
}

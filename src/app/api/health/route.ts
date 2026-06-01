import { NextResponse } from "next/server";
import {
  isServerLlmConfigured,
  isServerQwenCloudTtsConfigured,
  isServerQwenTtsConfigured,
  isServerTtsConfigured,
} from "@/lib/server/env";

export async function GET() {
  return NextResponse.json({
    serverTts: isServerTtsConfigured(),
    serverQwenTts: isServerQwenTtsConfigured(),
    serverQwenCloudTts: isServerQwenCloudTtsConfigured(),
    serverLlm: isServerLlmConfigured(),
  });
}

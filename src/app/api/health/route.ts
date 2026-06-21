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
import { getDeploymentMode, isSaasMode } from "@/lib/server/deploymentMode";

export async function GET() {
  const saas = isSaasMode();
  return NextResponse.json({
    deploymentMode: getDeploymentMode(),
    billingEnabled: saas,
    serverTts: saas && isServerTtsConfigured(),
    serverElevenLabsTts: saas && isServerElevenLabsConfigured(),
    serverOpenRouterTts: saas && isServerOpenRouterTtsConfigured(),
    serverFishAudioTts: saas && isServerFishAudioTtsConfigured(),
    serverFalTts: saas && isServerFalTtsConfigured(),
    serverQwenTts: saas && isServerQwenTtsConfigured(),
    serverQwenCloudTts: saas && isServerQwenCloudTtsConfigured(),
    serverLlm: saas && isServerLlmConfigured(),
  });
}

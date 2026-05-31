import { NextResponse } from "next/server";
import {
  isServerLlmConfigured,
  isServerTtsConfigured,
} from "@/lib/server/env";

export async function GET() {
  return NextResponse.json({
    serverTts: isServerTtsConfigured(),
    serverLlm: isServerLlmConfigured(),
  });
}

import { NextResponse } from "next/server";
import { isSaasMode } from "@/lib/server/deploymentMode";

/** Returns 404 JSON when running in local-first deployment (no cloud billing/auth APIs). */
export function saasOnlyGuard(): NextResponse | null {
  if (!isSaasMode()) {
    return NextResponse.json(
      { error: "Not available in local deployment mode", code: "local_deployment" },
      { status: 404 },
    );
  }
  return null;
}

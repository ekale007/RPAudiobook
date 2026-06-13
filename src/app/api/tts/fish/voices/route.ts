import { NextResponse } from "next/server";
import { getFishAudioVoiceCatalog } from "@/lib/server/fishAudioCatalog";
import { requireUser } from "@/lib/server/requireUser";

/** Fish Audio voice models from the server API key account. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const catalog = await getFishAudioVoiceCatalog();
    return NextResponse.json(catalog, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Voice catalog failed" },
      { status: 502 },
    );
  }
}

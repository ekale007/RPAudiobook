import { NextResponse } from "next/server";
import {
  canStoreNewTtsRecording,
  countUserTtsRecordings,
  getTtsStorageMaxPerUser,
  getTurnForCloudStorage,
} from "@/lib/server/ttsStorageQuota";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Authorize cloud save (quota + ownership). Client uploads MP3 directly to
 * Supabase Storage — avoids Vercel's ~4.5 MB request body limit.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let body: { turnId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  const turnId = String(body.turnId ?? "").trim();
  if (!turnId) {
    return NextResponse.json({ error: "turnId erforderlich" }, { status: 400 });
  }

  if (turnId.startsWith("tmp-")) {
    return NextResponse.json(
      { error: "Turn noch nicht gespeichert — bitte kurz warten." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseFromRequest(req);
  const turn = await getTurnForCloudStorage(supabase, turnId, auth.user.id);
  if (!turn) {
    return NextResponse.json({ error: "Turn nicht gefunden" }, { status: 404 });
  }

  const max = getTtsStorageMaxPerUser();
  const used = await countUserTtsRecordings(supabase);
  const existingPath = turn.audio_storage_path;

  if (!canStoreNewTtsRecording(used, max, existingPath)) {
    return NextResponse.json(
      {
        error: `Cloud-Limit erreicht (${max} Aufnahmen). Ältere löschen oder Turn bearbeiten.`,
        used,
        max,
      },
      { status: 403 },
    );
  }

  const path = `${auth.user.id}/${turnId}.mp3`;
  const usedAfter = existingPath ? used : Math.min(used + 1, max);

  return NextResponse.json({
    path,
    used: usedAfter,
    max,
    remaining: Math.max(0, max - usedAfter),
  });
}

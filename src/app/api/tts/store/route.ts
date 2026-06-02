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

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const turnId = String(form.get("turnId") ?? "").trim();
  const audio = form.get("audio");
  if (!turnId || !(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "turnId und audio (MP3) erforderlich" },
      { status: 400 },
    );
  }

  if (turnId.startsWith("tmp-")) {
    return NextResponse.json(
      { error: "Turn noch nicht gespeichert — bitte kurz warten." },
      { status: 400 },
    );
  }

  const maxBytes = 8 * 1024 * 1024;
  if (audio.size > maxBytes) {
    return NextResponse.json(
      { error: "Audio-Datei zu groß (max. 8 MB)" },
      { status: 413 },
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
  const buffer = Buffer.from(await audio.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("tts-audio")
    .upload(path, buffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message || "Upload fehlgeschlagen" },
      { status: 500 },
    );
  }

  const { error: updateError } = await supabase
    .from("turns")
    .update({ audio_storage_path: path })
    .eq("id", turnId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Datenbank-Update fehlgeschlagen" },
      { status: 500 },
    );
  }

  const usedAfter = existingPath
    ? used
    : Math.min(used + 1, max);

  return NextResponse.json({
    path,
    used: usedAfter,
    max,
    remaining: Math.max(0, max - usedAfter),
  });
}

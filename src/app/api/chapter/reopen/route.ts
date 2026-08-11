/**
 * POST /api/chapter/reopen — set a closed chapter back to active.
 *
 * Workaround für den Fall, dass ein Chapter-Close fehlschlug, bevor das
 * Folgeschapter erstellt wurde (nicht-atomarer Close): Die Story hat dann
 * kein aktives Chapter. Dieser Endpoint setzt ein geschlossenes Chapter
 * wieder auf "active" und deaktiviert alle anderen Chapters derselben Band.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let body: { chapterId?: string; storyId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const chapterId = body.chapterId?.trim();
  const storyId = body.storyId?.trim();
  if (!chapterId || !storyId) {
    return NextResponse.json(
      { error: "chapterId and storyId required" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseFromRequest(req);
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY fehlt — Admin-Client nicht verfügbar." },
      { status: 503 },
    );
  }

  // 1) Chapter + Story laden (Admin-Client, Ownership explizit prüfen).
  const { data: chapter, error: chErr } = await admin
    .from("chapters")
    .select("id, band_id, status, index_in_band")
    .eq("id", chapterId)
    .single();
  if (chErr || !chapter) {
    return NextResponse.json(
      { error: "Chapter not found" },
      { status: 404 },
    );
  }

  const { data: band, error: bandErr } = await admin
    .from("bands")
    .select("id, story_id")
    .eq("id", chapter.band_id)
    .single();
  if (bandErr || !band) {
    return NextResponse.json(
      { error: "Band not found for chapter" },
      { status: 404 },
    );
  }
  if (band.story_id !== storyId) {
    return NextResponse.json(
      { error: "Chapter belongs to a different story" },
      { status: 400 },
    );
  }

  const { data: story, error: stErr } = await admin
    .from("stories")
    .select("user_id")
    .eq("id", storyId)
    .single();
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }
  if (story.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2) Alle Chapters dieser Band auf "closed", dann das gewünschte auf "active".
  const { error: closeErr } = await admin
    .from("chapters")
    .update({ status: "closed" })
    .eq("band_id", chapter.band_id);
  if (closeErr) {
    return NextResponse.json(
      { error: "Failed to deactivate other chapters" },
      { status: 500 },
    );
  }

  const { error: reopenErr } = await admin
    .from("chapters")
    .update({ status: "active" })
    .eq("id", chapterId);
  if (reopenErr) {
    return NextResponse.json(
      { error: "Failed to reopen chapter" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    chapterId,
    status: "active",
    indexInBand: chapter.index_in_band,
  });
}
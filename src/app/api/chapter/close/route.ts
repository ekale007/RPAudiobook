/**
 * Phase 8: POST /api/chapter/close
 *
 * Runs the full chapter-close workflow server-side. The client opens the
 * AutoCloseOverlay, the user confirms, and we drive:
 *
 *   1. Plot-state finalize (LLM, fast ~2-4s)
 *   2. Chapter summary (LLM, ~6-12s for 30-50 turns)
 *   3. AI intro for the next chapter (LLM, ~3-5s)
 *   4. createNextChapter + seedChapterIntro (DB)
 *   5. rebuildBandSummaryIncremental (LLM, ~5-8s if previous band ≤ 800 words;
 *      else full re-aggregation which can run longer)
 *
 * The endpoint is intentionally NOT streaming — the client shows a single
 * running indicator while waiting. When the response arrives (2xx) the
 * client redirects to the new chapter; on error the overlay shows the
 * error and offers retry.
 *
 * Auth: requireUser (server-side cookie check). The OpenRouter key is the
 * server's account key (getOpenRouterApiKey), not a per-user key.
 *
 * Tier: we check `requireSpendableBalance` once before kicking the first
 * LLM call so a user with empty wallet doesn't burn through the whole
 * close workflow before failing.
 *
 * Local-mode stories (isLocalStoryId) are not supported — the client must
 * route them to the existing client-side flow.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import {
  getOpenRouterApiKey,
  getOpenRouterModel,
} from "@/lib/server/env";
import { fetchUserTierLimits } from "@/lib/server/userTier";
import { requireSpendableBalance } from "@/lib/server/wallet";
import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { OpenRouterSettings } from "@/lib/types";
import { extractPlotState } from "@/lib/memory/plotState";
import { summarizeChapter } from "@/lib/chapter/summarize";
import { resolveChapterIntro } from "@/lib/chapter/chapterIntro";
import { consolidateBandSummary } from "@/lib/chapter/bandSummary";
import type { TurnRow } from "@/lib/db/stories";

// Force dynamic — this endpoint runs LLM calls and writes to Supabase;
// we never want it to be statically cached.
export const dynamic = "force-dynamic";
// Vercel serverless maxFunctionDuration for the Pro tier is 60s. The full
// close workflow with 3-4 LLM calls + DB writes fits in that budget for
// typical chapter sizes (≤ 50 turns). Longer chapters may need a more
// aggressive fallback (compressBandSummary) or a job-queue pattern.
export const maxDuration = 60;

type Payload = {
  storyId?: unknown;
  chapterId?: unknown;
  bandId?: unknown;
  introMode?: unknown;
  customIntro?: unknown;
  nextTitle?: unknown;
};

type TurnRowDb = {
  id: string;
  chapter_id: string;
  index_in_chapter: number;
  role: string;
  content: string;
  speaker_slug: string | null;
};

function isValidString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length < 200;
}

function jsonError(
  status: number,
  error: string,
  code?: string,
): NextResponse {
  return NextResponse.json({ error, ...(code ? { code } : {}) }, { status });
}

function buildServerSettings(): OpenRouterSettings {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured on server");
  }
  return {
    apiKey,
    model: getOpenRouterModel(),
    maxTokens: 2048,
    temperature: 0.5,
  };
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonError(400, "Invalid JSON body", "invalid_input");
  }
  const { storyId, chapterId, bandId, introMode, customIntro, nextTitle } =
    body;
  if (!isValidString(storyId)) {
    return jsonError(400, "storyId is required", "invalid_input");
  }
  if (!isValidString(chapterId)) {
    return jsonError(400, "chapterId is required", "invalid_input");
  }
  if (!isValidString(bandId)) {
    return jsonError(400, "bandId is required", "invalid_input");
  }
  const validIntroModes = [
    "ai_bridge",
    "last_narration",
    "last_scene",
    "empty",
    "custom",
  ] as const;
  type IntroMode = (typeof validIntroModes)[number];
  const resolvedIntroMode: IntroMode =
    typeof introMode === "string" &&
    (validIntroModes as readonly string[]).includes(introMode)
      ? (introMode as IntroMode)
      : "ai_bridge";
  if (resolvedIntroMode === "custom" && typeof customIntro !== "string") {
    return jsonError(
      400,
      "customIntro is required when introMode is 'custom'",
      "invalid_input",
    );
  }
  if (nextTitle !== undefined && !isValidString(nextTitle)) {
    return jsonError(400, "nextTitle must be a non-empty string", "invalid_input");
  }

  const supabase = await createServerSupabaseFromRequest(req);

  // Tier check before any LLM work — same pattern as /api/llm/chat.
  let tierLimits;
  try {
    tierLimits = await fetchUserTierLimits(supabase, auth.user.id);
  } catch {
    tierLimits = null;
  }
  const balanceErr = await requireSpendableBalance(supabase, auth.user.id, 1);
  if (balanceErr) return balanceErr;

  // Build server-side OpenRouter settings.
  let settings: OpenRouterSettings;
  try {
    settings = buildServerSettings();
  } catch (e) {
    return jsonError(
      503,
      e instanceof Error ? e.message : "OpenRouter not configured",
      "openrouter_unconfigured",
    );
  }

  // Fetch the chapter + verify ownership + load the turns in one shot.
  const { data: chapter, error: chErr } = await supabase
    .from("chapters")
    .select("id, band_id, story_id, title, index_in_band, phase_hint, status")
    .eq("id", chapterId)
    .single();
  if (chErr || !chapter) {
    return jsonError(404, "Chapter not found", "chapter_not_found");
  }
  if (chapter.band_id !== bandId || chapter.story_id !== storyId) {
    return jsonError(
      400,
      "Chapter does not match provided storyId/bandId",
      "invalid_input",
    );
  }
  if (chapter.status === "closed") {
    return jsonError(
      400,
      "Chapter is already closed",
      "already_closed",
    );
  }

  // Verify story ownership (RLS would also enforce this; we check explicitly
  // so we can return a clean 403 instead of a 500 from RLS).
  const { data: story, error: stErr } = await supabase
    .from("stories")
    .select("id, user_id, settings")
    .eq("id", storyId)
    .single();
  if (stErr || !story) {
    return jsonError(404, "Story not found", "story_not_found");
  }
  if (story.user_id !== auth.user.id) {
    return jsonError(403, "Not authorized for this story", "forbidden");
  }

  // Load all turns in chapter order.
  const { data: turnRows, error: tErr } = await supabase
    .from("turns")
    .select("id, chapter_id, index_in_chapter, role, content, speaker_slug")
    .eq("chapter_id", chapterId)
    .order("index_in_chapter");
  if (tErr) {
    return jsonError(500, "Failed to load chapter turns", "db_error");
  }
  const rows = (turnRows ?? []) as TurnRowDb[];
  if (!rows.length) {
    return jsonError(
      400,
      "Chapter has no turns — nothing to summarize",
      "empty_chapter",
    );
  }

  // Map DB rows to the ChatTurn shape that summarizeChapter/extractPlotState
  // expect. Speaker slugs pass through; the local LLM prompt still works
  // because the speaker attribution is content-tagged in the chapterIntro
  // resolver, not in the ChatTurn type itself.
  const chatTurns = rows.map((r) => ({
    role: (r.role === "user" || r.role === "assistant" || r.role === "system"
      ? r.role
      : "assistant") as "user" | "assistant" | "system",
    content: r.content,
    speakerSlug: r.speaker_slug,
  }));

  const currentTitle = (chapter.title ?? "").trim() || `Chapter ${chapter.index_in_band}`;
  const phaseHint = chapter.phase_hint ?? null;

  // 1. Plot-state finalize.
  let plot;
  try {
    const existingPlot = (() => {
      try {
        const settingsJson = story.settings as Record<string, unknown> | null;
        return (settingsJson?.plotState as Parameters<typeof extractPlotState>[2]) ?? null;
      } catch {
        return null;
      }
    })();
    plot = await extractPlotState(settings, chatTurns, existingPlot, {
      chapterTitle: currentTitle,
      phaseHint,
    });
  } catch (e) {
    console.warn("close-chapter: plot-state extraction failed", e);
    return jsonError(
      502,
      "Plot-Stand konnte nicht gesichert werden. Bitte erneut versuchen.",
      "plot_extraction_failed",
    );
  }

  // Persist plot state immediately so the rest of the flow can read the
  // updated value. We do this before summarizeChapter so a partial failure
  // here doesn't lose the chapter's plot state.
  const { error: settingsErr } = await supabase
    .from("stories")
    .update({
      settings: {
        ...((story.settings as Record<string, unknown>) ?? {}),
        plotState: plot,
      },
    })
    .eq("id", storyId);
  if (settingsErr) {
    return jsonError(500, "Failed to persist plot state", "db_error");
  }

  // 2. Chapter summary.
  let summary: string;
  try {
    summary = await summarizeChapter(settings, chatTurns, currentTitle);
  } catch (e) {
    console.warn("close-chapter: summarize failed", e);
    return jsonError(
      502,
      "Zusammenfassung konnte nicht erstellt werden.",
      "summarize_failed",
    );
  }
  const closedAt = new Date().toISOString();
  const { error: updChErr } = await supabase
    .from("chapters")
    .update({
      chapter_summary: summary,
      status: "closed",
      closed_at: closedAt,
    })
    .eq("id", chapterId);
  if (updChErr) {
    return jsonError(500, "Failed to close chapter", "db_error");
  }

  // 3. Resolve next-phase hint from the freshly extracted plot state.
  // The phaseHintForNextChapter helper lives client-side; replicate the
  // logic here so we don't need to import a client-only file into a server
  // module. Same behaviour: prefer plot timeLabel, fall back to phase_hint,
  // drop stale "Akt I" / "Hours 0-4" values.
  const stalePhases = [
    "hours 0-4",
    "act i",
    "akt i",
    "first night",
    "erste nacht",
  ];
  const plotTime = (plot?.timeLabel ?? "").trim();
  const isStale = (v: string) =>
    stalePhases.some((s) => v.toLowerCase().includes(s));
  const nextPhaseHint =
    plotTime && !isStale(plotTime)
      ? plotTime
      : phaseHint && !isStale(phaseHint)
        ? phaseHint
        : null;

  // 3. AI intro for the next chapter.
  let introTurns: Array<{ content: string; speakerSlug?: string | null }> = [];
  try {
    const intro = await resolveChapterIntro(resolvedIntroMode, {
      settings,
      priorTurns: rows as unknown as TurnRow[],
      chapterSummary: summary,
      previousChapterTitle: currentTitle,
      nextChapterTitle:
        (typeof nextTitle === "string" && nextTitle.trim()) ||
        `Chapter ${chapter.index_in_band + 1}`,
      phaseHint: nextPhaseHint,
      customText: typeof customIntro === "string" ? customIntro : "",
    });
    introTurns = intro.turns;
  } catch (e) {
    // Non-fatal: continue without an intro. The new chapter just starts
    // empty. We log and let the close succeed.
    console.warn("close-chapter: intro resolve failed, continuing empty", e);
    introTurns = [];
  }

  // 5. Create the next chapter.
  const nextIndex = chapter.index_in_band + 1;
  const nextChapterTitle =
    (typeof nextTitle === "string" && nextTitle.trim()) ||
    `Chapter ${nextIndex}`;
  const { data: newChapter, error: createErr } = await supabase
    .from("chapters")
    .insert({
      band_id: bandId,
      index_in_band: nextIndex,
      title: nextChapterTitle,
      status: "active",
      phase_hint: nextPhaseHint,
    })
    .select("id")
    .single();
  if (createErr || !newChapter) {
    return jsonError(500, "Failed to create next chapter", "db_error");
  }
  const newChapterId = newChapter.id as string;

  // 6. Seed the intro turns if any. The intro resolver returns
  // speakerSlug as `string | null | undefined`; map to non-null for the DB.
  if (introTurns.length) {
    const introInsertRows = introTurns.map((it, i) => ({
      chapter_id: newChapterId,
      index_in_chapter: i,
      role: "assistant" as const,
      content: it.content,
      speaker_slug: it.speakerSlug || "narrator",
    }));
    const { error: introErr } = await supabase
      .from("turns")
      .insert(introInsertRows);
    if (introErr) {
      // Non-fatal: chapter exists, just without the intro.
      console.warn("close-chapter: intro seed failed", introErr);
    }
  }

  // 7. Incremental band consolidation. Same fallback hierarchy as the
  // client-side rebuildBandSummaryIncremental: incremental if previous
  // band is ≤ 800 words, else full re-aggregation.
  try {
    const { data: band, error: bandErr } = await supabase
      .from("bands")
      .select("band_summary")
      .eq("id", bandId)
      .single();
    if (bandErr) throw bandErr;
    const previousBandSummary =
      (band?.band_summary as string | null | undefined) ?? null;

    const consolidated = await consolidateBandSummary({
      previousBandSummary,
      newChapterSummary: summary,
      newChapterTitle: currentTitle,
      newChapterIndex: chapter.index_in_band,
      settings,
    });
    // The helper returns the previous band unchanged when it has too many
    // words (>800). In that case we fall through to a full re-aggregation
    // so the LLM gets a chance to compress.
    if (consolidated === (previousBandSummary ?? "")) {
      // Full re-aggregation path: read all closed chapters and rebuild.
      const { data: allChapters, error: acErr } = await supabase
        .from("chapters")
        .select("id, title, index_in_band, status, chapter_summary")
        .eq("band_id", bandId)
        .order("index_in_band");
      if (acErr) throw acErr;
      const closed = (allChapters ?? [])
        .filter(
          (c) =>
            c.status === "closed" &&
            typeof c.chapter_summary === "string" &&
            c.chapter_summary.trim().length > 0,
        )
        .sort((a, b) => a.index_in_band - b.index_in_band)
        .map(
          (c) =>
            `### Chapter ${c.index_in_band}: ${c.title}\n${(c.chapter_summary as string).trim()}`,
        )
        .join("\n\n");
      let rebuilt = closed;
      if (rebuilt.length > 10_000) {
        // compressBandSummary is exported from bandSummary.ts and follows
        // the same prompt as the client-side helper. We import it lazily
        // to keep this module's cold-start cost down.
        const { compressBandSummary } = await import(
          "@/lib/chapter/bandSummary"
        );
        const closedCount = closed
          .split("### Chapter")
          .filter((s) => s.trim().length > 0).length;
        rebuilt = await compressBandSummary(settings, rebuilt, closedCount);
      }
      const { error: updBandErr } = await supabase
        .from("bands")
        .update({ band_summary: rebuilt })
        .eq("id", bandId);
      if (updBandErr) throw updBandErr;
    } else {
      const { error: updBandErr } = await supabase
        .from("bands")
        .update({ band_summary: consolidated })
        .eq("id", bandId);
      if (updBandErr) throw updBandErr;
    }
  } catch (e) {
    // Non-fatal: the close succeeded, band summary just didn't update.
    // The next close will catch up.
    console.warn("close-chapter: band consolidation failed", e);
  }

  // 8. Touch story.updated_at so the library re-orders.
  try {
    await supabase
      .from("stories")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", storyId);
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    ok: true,
    newChapterId,
    newChapterTitle: nextChapterTitle,
    closedChapterTitle: currentTitle,
    introTurnsCount: introTurns.length,
  });
}

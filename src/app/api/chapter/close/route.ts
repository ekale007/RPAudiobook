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
 * DB: we use the **admin (service-role) Supabase client** for all DB
 * reads/writes after auth, not the user client. RLS is bypassed
 * intentionally here — the user has already been authenticated, the
 * story is explicitly checked for ownership, and we need to write to
 * several tables (chapters, turns, bands, stories) that have their own
 * RLS policies. Without admin, RLS would block legitimate writes
 * because the chapter/turn rows aren't directly owned by the user — they
 * belong to a band that belongs to a story the user owns. Same pattern
 * as /api/admin/* routes.
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
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getOpenRouterApiKey,
  getOpenRouterModel,
} from "@/lib/server/env";
import { fetchUserTierLimits } from "@/lib/server/userTier";
import { requireSpendableBalance } from "@/lib/server/wallet";
import { appendTurnsToMemoryStream } from "@/lib/server/memoryStream";
import { requireLlmMonthlyBudget } from "@/lib/server/llmUsage";
import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { OpenRouterSettings } from "@/lib/types";
import { extractPlotState } from "@/lib/memory/plotState";
import { summarizeChapter } from "@/lib/chapter/summarize";
import { resolveChapterIntro } from "@/lib/chapter/chapterIntro";
import { consolidateBandSummary } from "@/lib/chapter/bandSummary";
import { setServerLlmContext, clearServerLlmContext, serverCompleteOpenRouter } from "@/lib/llm/serverCompletion";
import { generateReflectionCore, parseReflections, appendReflection } from "@/lib/memory/reflections";
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
  // bandId is optional. The client may send it (preferred — it lives in
  // ChapterRow already) or omit it. The server falls back to the chapter
  // row's band_id when missing. An explicit non-string value is a
  // client bug — we ignore it instead of erroring.
  if (
    bandId !== undefined &&
    bandId !== null &&
    bandId !== "" &&
    !isValidString(bandId)
  ) {
    return jsonError(400, "bandId must be a non-empty string", "invalid_input");
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

  const userSupabase = await createServerSupabaseFromRequest(req);

  // Tier check before any LLM work — same pattern as /api/llm/chat. We
  // use the user-scoped client here because tier limits + wallet live in
  // tables that have user_id RLS — the user client reads the right row.
  let tierLimits;
  try {
    tierLimits = await fetchUserTierLimits(userSupabase, auth.user.id);
  } catch {
    tierLimits = null;
  }
  const balanceErr = await requireSpendableBalance(
    userSupabase,
    auth.user.id,
    1,
  );
  if (balanceErr) return balanceErr;

  // Monthly LLM budget gate — same gate as /api/llm/chat.
  const budgetErr = await requireLlmMonthlyBudget(
    userSupabase,
    auth.user.id,
    tierLimits,
  );
  if (budgetErr) return budgetErr;

  // Hand the tier limits + a working supabase client
  // `completeOpenRouter` module so the LLM calls below route through
  // server-side OpenRouter directly (no relative-URL authFetch roundtrip
  // — that throws ERR_INVALID_URL on Vercel serverless). See
  // lib/llm/serverCompletion.ts. We clear the context in `finally` so
  // a re-used module global can't leak into the next request.
  const effectiveTierLimits = tierLimits ?? {
    tier: "beta" as const,
    tierLabel: "Beta",
    llmBudgetCents: 0,
    llmPerHour: 60,
    ttsPerHour: 60,
    ttsStorageMax: 100,
    allowedModelIds: null,
  };
  setServerLlmContext({ supabase: userSupabase, tierLimits: effectiveTierLimits });
  try {

  // Switch to the service-role (admin) client for all chapter/story/band
  // operations. RLS is bypassed — we re-check ownership explicitly via
  // `story.user_id === auth.user.id` below. The user client + RLS was
  // returning PGRST116 for legitimate chapter reads/writes because the
  // chapter rows are owned by the band (which is owned by the story the
  // user owns), not directly by the user.
  const admin = createAdminSupabase();
  if (!admin) {
    return jsonError(
      503,
      "SUPABASE_SERVICE_ROLE_KEY fehlt — Endpoint braucht Admin-Client.",
      "admin_unconfigured",
    );
  }
  const supabase = admin;

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

  // Preflight: reject local-mode IDs explicitly so the client can fall back
  // to the client-side close flow without an extra round-trip.
  if (
    (typeof storyId === "string" && storyId.startsWith("local-")) ||
    (typeof chapterId === "string" && chapterId.startsWith("local-")) ||
    (typeof bandId === "string" && bandId.startsWith("local-"))
  ) {
    return jsonError(
      400,
      "Lokale Storys müssen den client-seitigen Abschluss-Flow nutzen.",
      "local_mode_unsupported",
    );
  }

  // Phase 8.5: chapter-SELECT only reads chapter-owned columns. The
  // chapters table has no `story_id` column — that's on bands. We do a
  // 2-stage lookup: chapter → band → story. This matches the schema
  // "Story → Band → Chapter" (AGENTS.md) and avoids the column-doesn't-
  // exist error that broke 8.3. Logging the inputs and each lookup
  // result so we can see exactly where things go wrong.
  console.log(
    `[close-chapter] start chapterId=${chapterId} storyId=${storyId} bandId=${
      bandId || "(omitted)"
    }`,
  );
  const { data: chapter, error: chErr } = await supabase
    .from("chapters")
    .select("id, band_id, title, index_in_band, phase_hint, status")
    .eq("id", chapterId)
    .single();
  if (chErr) {
    console.log(
      `[close-chapter] chapter-SELECT error: code=${chErr.code} message=${chErr.message} hint=${
        chErr.hint ?? ""
      } chapterId=${chapterId}`,
    );
  } else if (chapter) {
    console.log(
      `[close-chapter] chapter-SELECT ok: id=${chapter.id} status=${chapter.status} band_id=${chapter.band_id}`,
    );
  }
  if (chErr?.code === "PGRST116" || (!chapter && chErr)) {
    return jsonError(
      404,
      "Chapter nicht zugänglich — entweder nicht vorhanden oder keine Lese-Berechtigung.",
      "chapter_not_accessible",
    );
  }
  if (chErr || !chapter) {
    return jsonError(404, "Chapter not found", "chapter_not_found");
  }

  // bandId is optional in the body (server resolves from chapter).
  if (bandId && chapter.band_id !== bandId) {
    return jsonError(
      400,
      "Chapter does not match provided bandId",
      "invalid_input",
    );
  }

  // Phase 8.5: fetch the parent band to get the story_id (chapters don't
  // carry it directly). Two-stage join because there's no foreign-key
  // embed in the table.
  const { data: band, error: bandErr } = await supabase
    .from("bands")
    .select("id, story_id, band_summary")
    .eq("id", chapter.band_id)
    .single();
  if (bandErr || !band) {
    console.log(
      `[close-chapter] band-SELECT error: code=${
        bandErr?.code ?? "no-row"
      } message=${bandErr?.message ?? ""} bandId=${chapter.band_id}`,
    );
    return jsonError(404, "Band not found for this chapter", "band_not_found");
  }
  console.log(
    `[close-chapter] band-SELECT ok: id=${band.id} story_id=${band.story_id}`,
  );

  if (band.story_id !== storyId) {
    return jsonError(
      400,
      "Chapter belongs to a different story than provided",
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

  // Verify story ownership. With service-role this always returns the
  // row, but we still check user_id to enforce the auth boundary.
  const { data: story, error: stErr } = await supabase
    .from("stories")
    .select("id, user_id, settings")
    .eq("id", storyId)
    .single();
  if (!story) {
    console.log(
      `[close-chapter] story-SELECT error: no-row storyId=${storyId} (stErr=${
        stErr ? `${stErr.code} ${stErr.message}` : "none"
      })`,
    );
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

  // 1+2. Plot-state extraction and chapter summary run in parallel —
  // they share chatTurns + title but are otherwise independent.
  // Saves ~5-8s on typical chapters (25-40 turns).
  let plot;
  let summary: string;
  {
    const existingPlot = (() => {
      try {
        const settingsJson = story.settings as Record<string, unknown> | null;
        return (settingsJson?.plotState as Parameters<typeof extractPlotState>[2]) ?? null;
      } catch {
        return null;
      }
    })();

    const [plotSettled, summarySettled] = await Promise.allSettled([
      extractPlotState(settings, chatTurns, existingPlot, {
        chapterTitle: currentTitle,
        phaseHint,
      }),
      summarizeChapter(settings, chatTurns, currentTitle),
    ]);

    if (plotSettled.status === "rejected") {
      console.warn("close-chapter: plot-state extraction failed", plotSettled.reason);
      return jsonError(
        502,
        "Plot-Stand konnte nicht gesichert werden. Bitte erneut versuchen.",
        "plot_extraction_failed",
      );
    }
    if (summarySettled.status === "rejected") {
      console.warn("close-chapter: summarize failed", summarySettled.reason);
      return jsonError(
        502,
        "Zusammenfassung konnte nicht erstellt werden.",
        "summarize_failed",
      );
    }
    plot = plotSettled.value;
    summary = summarySettled.value;
  }

  // Persist plot + summary.
  const closedAt = new Date().toISOString();
  {
    const [settingsErr, updChErr] = await Promise.all([
      supabase
        .from("stories")
        .update({
          settings: {
            ...((story.settings as Record<string, unknown>) ?? {}),
            plotState: plot,
          },
        })
        .eq("id", storyId)
        .then(
          () => null,
          (e: unknown) => e,
        ),
      supabase
        .from("chapters")
        .update({
          chapter_summary: summary,
          status: "closed",
          closed_at: closedAt,
        })
        .eq("id", chapterId)
        .then(
          () => null,
          (e: unknown) => e,
        ),
    ]);
    if (settingsErr) return jsonError(500, "Failed to persist plot state", "db_error");
    if (updChErr) return jsonError(500, "Failed to close chapter", "db_error");
  }

  // 2.4. Memory-Stream-Update (Engine 2A).
  // Best-effort: append all turns of the closed chapter to the memory
  // stream for later retrieval. Idempotent (skips existing turn_id).
  {
    try {
      const streamTurns = rows.map((r) => ({
        turnId: r.id,
        content: r.content ?? "",
        chapterIndex: chapter.index_in_band,
        importance: 0.5,
      }));
      const { inserted } = await appendTurnsToMemoryStream(
        supabase,
        storyId,
        streamTurns,
      );
      if (inserted > 0) {
        console.info(`close-chapter: memory stream +${inserted} turns`);
      }
    } catch (e) {
      console.warn("close-chapter: memory stream update failed", e);
    }
  }

  // 2.5. Reflection layer update (Diagnose Task 2B).
  // Best-effort: generates a high-level story state snapshot for the
  // LLM system prompt. Failure here does NOT roll back the chapter close.
  try {
    const storySettings = (story.settings as Record<string, unknown>) ?? {};
    const existingContainer = parseReflections(storySettings.storyReflections);
    const lastReflection =
      existingContainer.reflections.length > 0
        ? existingContainer.reflections[existingContainer.reflections.length - 1]
        : null;
    const plotSummary = plot.timeLabel
      ? `${plot.timeLabel} — ${plot.location ?? "unknown location"}`
      : (plot.location ?? "unknown location");

    const newReflection = await generateReflectionCore(
      (msgs, opts) =>
        serverCompleteOpenRouter(msgs, {
          maxTokens: opts.maxTokens,
          temperature: opts.temperature,
          responseFormat: opts.responseFormat,
        }).then((r: { content: string }) => r.content),
      {
        turns: chatTurns,
        existing: lastReflection,
        plotStateSummary: plotSummary,
        currentTurnIndex: rows[rows.length - 1].index_in_chapter,
      },
    );

    const updated = appendReflection(existingContainer, newReflection);
    storySettings.storyReflections = updated;
    await admin.from("stories").update({ settings: storySettings }).eq("id", storyId);
  } catch (e) {
    console.warn("close-chapter: reflection update failed", e);
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
  } finally {
    // Always clear the per-request LLM context so a re-used module
    // global can't leak tierLimits from one user into the next request
    // if Vercel ever warms this lambda.
    clearServerLlmContext();
  }
}

/**
 * Phase 8: client wrapper for the auto-close-chapter background flow.
 *
 * The server endpoint (POST /api/chapter/close) runs the full close
 * workflow server-side: plot-lock → chapter summary → intro → new chapter →
 * band consolidation. While it runs, the client renders a phase overlay.
 *
 * Server contract (see src/app/api/chapter/close/route.ts):
 *   - 401 session_required when no auth cookie
 *   - 400 invalid_input on bad payload
 *   - 404 chapter_not_found / band_not_found
 *   - 200 { newChapterId, newChapterTitle, closedChapterTitle, introTurnsCount }
 *     when the chapter was closed and a new one created
 *   - 500 { error: string } on any LLM/DB failure (the overlay shows the
 *     error and offers a retry that re-POSTs the same payload)
 *
 * The client has no streaming channel for the per-step progress — we show
 * a single "Wird abgeschlossen …" indicator during the request. When the
 * server finishes (2-10s typical), the overlay flips to "done" and we
 * router.push the new chapter.
 */

export type CloseChapterRequest = {
  storyId: string;
  chapterId: string;
  bandId: string;
  introMode: "ai_bridge" | "last_narration" | "last_scene" | "empty" | "custom";
  customIntro?: string;
  nextTitle?: string;
};

export type CloseChapterSuccess = {
  ok: true;
  newChapterId: string;
  newChapterTitle: string;
  closedChapterTitle: string;
  introTurnsCount: number;
};

export type CloseChapterFailure = {
  ok: false;
  status: number;
  error: string;
  code?: "session_required" | "invalid_input" | "chapter_not_found" | "band_not_found" | string;
};

export type CloseChapterResult = CloseChapterSuccess | CloseChapterFailure;

export async function postCloseChapter(
  body: CloseChapterRequest,
  signal?: AbortSignal,
): Promise<CloseChapterResult> {
  let res: Response;
  try {
    res = await fetch("/api/chapter/close", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error:
        e instanceof Error ? e.message : "Netzwerkfehler beim Kapitelabschluss.",
    };
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON body — fall through with status-only error.
  }
  if (!res.ok) {
    const errMsg =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Server-Fehler ${res.status}`;
    const code =
      payload && typeof payload === "object" && "code" in payload
        ? String((payload as { code: unknown }).code)
        : undefined;
    return { ok: false, status: res.status, error: errMsg, code };
  }

  if (!payload || typeof payload !== "object") {
    return { ok: false, status: res.status, error: "Unerwartete Server-Antwort." };
  }
  const p = payload as Partial<CloseChapterSuccess>;
  if (
    typeof p.newChapterId !== "string" ||
    typeof p.newChapterTitle !== "string" ||
    typeof p.closedChapterTitle !== "string" ||
    typeof p.introTurnsCount !== "number"
  ) {
    return { ok: false, status: res.status, error: "Antwort-Felder unvollständig." };
  }
  return {
    ok: true,
    newChapterId: p.newChapterId,
    newChapterTitle: p.newChapterTitle,
    closedChapterTitle: p.closedChapterTitle,
    introTurnsCount: p.introTurnsCount,
  };
}

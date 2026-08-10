/**
 * Memory-Stream (Engine 2A — Stanford-Pattern Retrieval).
 *
 * Append-only Stream aller Chat-Turns pro Story. Beim Prompt-Build wird
 * stattdessen nur der Top-K relevanteste Ausschnitt per 3-Faktor-Score
 * geladen: Recency (0-1) x Importance (0-1) x Embedding-Cosine (0-1).
 *
 * Embeddings laufen ueber OpenRouter `/embeddings` (text-embedding-3-small).
 * Wenn kein API-Key gesetzt ist oder der Call fehlschlaegt, faellt das
 * Retrieval auf Recency x Importance zurueck (`embedding IS NULL`-Pfad) —
 * das System funktioniert dann immer noch, nur ohne semantische Suche.
 */

import { brand } from "@/lib/brand";
import { getOpenRouterApiKey } from "@/lib/server/env";
import type { SupabaseClient } from "@supabase/supabase-js";

const EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIM = 1536;

export type MemoryStreamRow = {
  id: string;
  turn_id: string | null;
  chapter_index: number | null;
  timestamp: string;
  content: string;
  importance: number;
};

type TurnForMemory = {
  turnId?: string | null;
  content: string;
  importance?: number | null;
  chapterIndex?: number | null;
  timestamp?: string | null;
};

/** OpenRouter embeddings call; returns null on any failure (graceful). */
export async function embedTexts(
  texts: string[],
): Promise<number[][] | null> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey || texts.length === 0) return null;
  try {
    const res = await fetch(EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        "X-Title": brand.openRouterAppTitle,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts.map((t) => t.slice(0, 6000)),
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vecs = (json.data ?? [])
      .map((d) => d.embedding)
      .filter((v): v is number[] => Array.isArray(v) && v.length === EMBEDDING_DIM);
    return vecs.length === texts.length ? vecs : null;
  } catch {
    return null;
  }
}

function importanceOf(turn: TurnForMemory): number {
  const raw = turn.importance;
  if (raw == null || Number.isNaN(raw)) return 0.5;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Append turns to the memory stream (best-effort; RLS-scoped via story).
 * Skips turns that are already present (same turn_id) to keep the stream
 * append-only without duplicates when chapter-close reruns.
 */
export async function appendTurnsToMemoryStream(
  supabase: SupabaseClient,
  storyId: string,
  turns: TurnForMemory[],
): Promise<{ inserted: number; skipped: number }> {
  if (turns.length === 0) return { inserted: 0, skipped: 0 };

  const existing: { turn_id: string | null }[] = [];
  const ids = turns
    .map((t) => t.turnId?.trim())
    .filter((id): id is string => Boolean(id));
  if (ids.length > 0) {
    const { data } = await supabase
      .from("memory_stream")
      .select("turn_id")
      .eq("story_id", storyId)
      .in("turn_id", ids);
    existing.push(...(data ?? []));
  }
  const seen = new Set(existing.map((e) => e.turn_id));

  const fresh = turns.filter((t) => !t.turnId || !seen.has(t.turnId));
  if (fresh.length === 0) return { inserted: 0, skipped: turns.length };

  const texts = fresh.map((t) => t.content.slice(0, 4000));
  const embeddings = await embedTexts(texts);

  const rows = fresh.map((t, i) => ({
    story_id: storyId,
    turn_id: t.turnId?.trim() || null,
    chapter_index: t.chapterIndex ?? null,
    timestamp: t.timestamp ?? new Date().toISOString(),
    content: t.content.slice(0, 4000),
    importance: importanceOf(t),
    embedding: embeddings?.[i] ?? null,
  }));

  const { error } = await supabase.from("memory_stream").insert(rows);
  if (error) {
    console.error("appendTurnsToMemoryStream: insert failed", error);
    return { inserted: 0, skipped: turns.length };
  }
  return { inserted: rows.length, skipped: turns.length - rows.length };
}

/** Delete entries for a story (used by full-reset / story delete). */
export async function clearMemoryStream(
  supabase: SupabaseClient,
  storyId: string,
): Promise<void> {
  await supabase.from("memory_stream").delete().eq("story_id", storyId);
}

type RetrievedTurn = {
  content: string;
  timestamp: string;
  importance: number;
};

/**
 * Load the Top-K most relevant memory-stream turns for the given query.
 * 3-Faktor-Score: if embeddings are present, cosine similarity is computed
 * server-side via Supabase `<=>`; otherwise recency x importance only.
 */
export async function retrieveMemoryStream(
  supabase: SupabaseClient,
  storyId: string,
  queryEmbedding: number[] | null,
  opts?: { topK?: number; ceilingSec?: number; newerThanSec?: number },
): Promise<RetrievedTurn[]> {
  const topK = opts?.topK ?? 6;
  const newerThanSec = opts?.newerThanSec ?? 0;

  let q = supabase
    .from("memory_stream")
    .select(
      "content, timestamp, importance, embedding",
    )
    .eq("story_id", storyId)
    .order("timestamp", { ascending: false })
    .limit(200);

  if (newerThanSec > 0) {
    const cutoff =
      new Date(Date.now() - newerThanSec * 1000).toISOString();
    q = q.gte("timestamp", cutoff);
  }

  const { data, error } = await q;
  if (error || !data) {
    return [];
  }

  const candidates = data as Array<{
    content: string;
    timestamp: string;
    importance: number;
    embedding: number[] | null;
  }>;

  const scored: Array<{ turn: RetrievedTurn; score: number }> = [];
  for (const row of candidates) {
    const recency = recencyScore(row.timestamp);
    const importance = clamp(row.importance);
    let relevance = 1;
    if (queryEmbedding && row.embedding) {
      relevance = cosineSimilarity(queryEmbedding, row.embedding);
    }
    scored.push({
      turn: { content: row.content, timestamp: row.timestamp, importance },
      score: recency * importance * relevance,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.turn);
}

function recencyScore(iso: string): number {
  const ageMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ageMs) || ageMs <= 0) return 1;
  const ageHours = ageMs / (60 * 60 * 1000);
  return Math.max(0, 1 - ageHours / 24); // 24h Halbwert
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Embed a query text via OpenRouter (or null → relevance factor = 1). */
export async function embedQuery(
  text: string,
): Promise<number[] | null> {
  const vecs = await embedTexts([text]);
  return vecs?.[0] ?? null;
}
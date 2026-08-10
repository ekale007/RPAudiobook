/**
 * GET /api/memory/retrieve?storyId=...&query=...
 *
 * Engine 2A: retrieves the Top-K most relevant memory-stream turns for a
 * story, scored by Recency x Importance x Embedding-Cosine. Embeddings are
 * computed server-side (OpenRouter key stays secret).
 *
 * Returns turns in relevance order. Graceful degreation: when no embedding
 * is available, relevance factor = 1 (recency x importance only).
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { embedQuery, retrieveMemoryStream } from "@/lib/server/memoryStream";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const storyId = url.searchParams.get("storyId")?.trim();
  const query = url.searchParams.get("query")?.trim();
  if (!storyId) {
    return NextResponse.json(
      { error: "storyId required" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseFromRequest(req);

  let queryEmbedding: number[] | null = null;
  if (query) {
    queryEmbedding = await embedQuery(query);
  }

  const turns = await retrieveMemoryStream(supabase, storyId, queryEmbedding, {
    topK: 6,
  });

  return NextResponse.json({ turns });
}
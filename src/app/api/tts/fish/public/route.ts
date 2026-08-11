/**
 * GET /api/tts/fish/public?language=de&page=1&pageSize=50
 *
 * Public Fish Audio voice library — no API key required. 1000+ voices
 * with tags (male/female/deep/energetic...), language filter and
 * popularity sorting. Server-side cache (5 min) keeps the upstream
 * polite. Preview URLs come straight through for inline playback.
 */
import { NextResponse } from "next/server";

export type FishPublicVoiceEntry = {
  id: string;
  label: string;
  description: string;
  languages: string[];
  tags: string[];
  previewUrl: string | null;
  likes: number;
};

export type FishPublicVoiceResult = {
  voices: FishPublicVoiceEntry[];
  hasMore: boolean;
  total?: number;
};

const FISH_MODELS_URL = "https://api.fish.audio/model";
const CACHE_TTL_MS = 5 * 60 * 1000;

let publicCache: {
  key: string;
  at: number;
  result: FishPublicVoiceResult;
} | null = null;

function toEntry(item: Record<string, unknown>): FishPublicVoiceEntry {
  const samples = (item.samples ?? []) as Array<{ audio?: string }>;
  return {
    id: String(item._id ?? ""),
    label: String(item.title ?? "Unbenannt"),
    description: String(item.description ?? ""),
    languages: (item.languages ?? []) as string[],
    tags: (item.tags ?? []) as string[],
    previewUrl: samples.find((s) => s.audio)?.audio ?? null,
    likes: Number(item.like_count ?? 0),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const language = url.searchParams.get("language")?.trim() ?? "";
  const sort = url.searchParams.get("sort")?.trim() ?? "likes";
  let page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  let pageSize = Math.min(
    100,
    Math.max(10, Number(url.searchParams.get("pageSize") ?? 50) || 50),
  );

  // Weighted popularity: like_count + mark_count*0.4 + shared_count*0.3
  // is not available via API sort — use like_count (verified working).
  const cacheKey = `${language}|${sort}|${page}|${pageSize}`;
  if (publicCache && publicCache.key === cacheKey && Date.now() - publicCache.at < CACHE_TTL_MS) {
    return NextResponse.json(publicCache.result, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  const params = new URLSearchParams({
    self: "false",
    page_size: String(pageSize),
    page_number: String(page),
  });
  if (language) params.set("language", language);
  if (sort === "likes") params.set("sort", "like_count");

  try {
    const res = await fetch(`${FISH_MODELS_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "RP-Audiobook/1.0",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Fish API ${res.status}` },
        { status: 502 },
      );
    }
    const json = (await res.json()) as {
      items?: Record<string, unknown>[];
      has_more?: boolean | null;
      total?: number;
    };
    const result: FishPublicVoiceResult = {
      voices: (json.items ?? []).map(toEntry).filter((v) => v.id),
      hasMore: Boolean(json.has_more),
      total: json.total,
    };
    publicCache = { key: cacheKey, at: Date.now(), result };
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fish public library failed" },
      { status: 502 },
    );
  }
}
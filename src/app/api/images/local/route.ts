import { NextResponse } from "next/server";
import { isLocalImageGenEnabled } from "@/lib/images/imagePromptPresets";

const DEFAULT_SERVER =
  process.env.LOCAL_IMAGE_URL?.trim() || "http://127.0.0.1:5125";

function disabledResponse() {
  return NextResponse.json(
    {
      error:
        "Lokaler Bildgenerator nur in der Entwicklungsumgebung (oder mit LOCAL_IMAGE_GEN=1).",
    },
    { status: 403 },
  );
}

export async function GET() {
  if (!isLocalImageGenEnabled()) return disabledResponse();

  const base = DEFAULT_SERVER.replace(/\/$/, "");
  try {
    const upstream = await fetch(`${base}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Image server antwortet mit ${upstream.status}. Start: npm run images:server`,
        },
        { status: 503 },
      );
    }
    const json = await upstream.json();
    return NextResponse.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error: `Kein Bild-Server unter ${base}. Start: npm run images:server (${msg})`,
      },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  if (!isLocalImageGenEnabled()) return disabledResponse();

  let body: {
    prompt?: string;
    width?: number;
    height?: number;
    steps?: number;
    seed?: number | null;
    quality?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt || prompt.length < 8) {
    return NextResponse.json(
      { error: "Prompt zu kurz (min. 8 Zeichen)." },
      { status: 400 },
    );
  }

  const base = DEFAULT_SERVER.replace(/\/$/, "");
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        width: body.width ?? 768,
        height: body.height ?? 1152,
        steps: body.steps ?? 4,
        seed: body.seed ?? null,
        quality: body.quality ?? 88,
      }),
      signal: AbortSignal.timeout(600_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: `Bild-Server nicht erreichbar (${base}). npm run images:server — ${msg}`,
      },
      { status: 503 },
    );
  }

  if (!upstream.ok) {
    let errText = upstream.statusText;
    try {
      const json = (await upstream.json()) as { detail?: string };
      if (json.detail) errText = json.detail;
    } catch {
      errText = (await upstream.text()) || errText;
    }
    return NextResponse.json({ error: errText }, { status: upstream.status });
  }

  const image = await upstream.arrayBuffer();
  return new NextResponse(image, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
    },
  });
}

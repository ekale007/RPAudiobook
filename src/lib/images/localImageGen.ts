import {
  IMAGE_GEN_SIZES,
  type ImageGenKind,
} from "@/lib/images/imagePromptPresets";

export type LocalImageGenRequest = {
  prompt: string;
  kind?: ImageGenKind;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number | null;
};

export type LocalImageGenHealth = {
  ok: boolean;
  engine?: string;
  error?: string;
};

export async function checkLocalImageGenHealth(): Promise<LocalImageGenHealth> {
  try {
    const res = await fetch("/api/images/local", { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, error: await res.text() };
    }
    const json = (await res.json()) as { ok?: boolean; engine?: string };
    return { ok: Boolean(json.ok), engine: json.engine };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function generateLocalImage(
  req: LocalImageGenRequest,
  signal?: AbortSignal,
): Promise<Blob> {
  const kind = req.kind ?? "cover";
  const defaults = IMAGE_GEN_SIZES[kind];
  const res = await fetch("/api/images/local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: req.prompt,
      width: req.width ?? defaults.width,
      height: req.height ?? defaults.height,
      steps: req.steps ?? defaults.steps,
      seed: req.seed ?? null,
    }),
    signal,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  return res.blob();
}

/** Style prefixes and sizes for local SDXL-Turbo generation. */

export type ImageGenKind = "cover" | "portrait";

export const IMAGE_GEN_KINDS: { id: ImageGenKind; label: string }[] = [
  { id: "cover", label: "Buchcover (2:3)" },
  { id: "portrait", label: "Charakterporträt (1:1)" },
];

export const COVER_STYLE_PREFIX =
  "Audiobook cover illustration, vertical portrait 2:3, painterly cinematic digital art, rich lighting, no text, no title, no logos, no watermark, ";

export const PORTRAIT_STYLE_PREFIX =
  "Character portrait illustration, head and shoulders, square 1:1, painterly cinematic digital art, rich lighting, expressive face, no text, no watermark, ";

export const IMAGE_GEN_SIZES: Record<
  ImageGenKind,
  { width: number; height: number; steps: number }
> = {
  cover: { width: 768, height: 1152, steps: 4 },
  portrait: { width: 768, height: 768, steps: 4 },
};

export function withStylePrefix(kind: ImageGenKind, userPrompt: string): string {
  const trimmed = userPrompt.trim();
  const prefix =
    kind === "cover" ? COVER_STYLE_PREFIX : PORTRAIT_STYLE_PREFIX;
  if (!trimmed) return prefix.trim();
  if (
    trimmed.toLowerCase().startsWith("audiobook cover") ||
    trimmed.toLowerCase().startsWith("book cover") ||
    trimmed.toLowerCase().startsWith("character portrait")
  ) {
    return trimmed;
  }
  return `${prefix}${trimmed}`;
}

export function buildCharacterPortraitPrompt(input: {
  name: string;
  description?: string | null;
  personality?: string | null;
  scenario?: string | null;
}): string {
  const parts = [
    input.name.trim(),
    input.description?.trim(),
    input.personality?.trim(),
    input.scenario?.trim(),
  ].filter(Boolean);
  return (
    parts.join(". ") ||
    "original fantasy character, distinctive outfit, neutral background"
  );
}

export function isLocalImageGenEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.LOCAL_IMAGE_GEN === "1";
}

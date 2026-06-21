export type ImageFormatId =
  | "cover"
  | "portrait"
  | "landscape"
  | "banner"
  | "square"
  | "thumbnail";

export type ImageFormatPreset = {
  id: ImageFormatId;
  label: string;
  hint: string;
  width: number;
  height: number;
  steps: number;
  stylePrefix: string;
  optimizeHint: string;
};

export const IMAGE_FORMAT_PRESETS: ImageFormatPreset[] = [
  {
    id: "cover",
    label: "Buchcover 2:3",
    hint: "Hörbuch-Cover, Hochformat",
    width: 768,
    height: 1152,
    steps: 4,
    stylePrefix:
      "Audiobook cover illustration, vertical portrait 2:3, painterly cinematic digital art, rich lighting, no text, no title, no logos, no watermark, ",
    optimizeHint:
      "vertical audiobook cover, strong focal subject, mood and palette, epic but readable at thumbnail size",
  },
  {
    id: "portrait",
    label: "Porträt 1:1",
    hint: "Figur, Kopf & Schultern",
    width: 768,
    height: 768,
    steps: 4,
    stylePrefix:
      "Character portrait illustration, head and shoulders, square 1:1, painterly cinematic digital art, rich lighting, expressive face, no text, no watermark, ",
    optimizeHint:
      "character head and shoulders, expressive face, outfit details, neutral or soft background",
  },
  {
    id: "landscape",
    label: "Szene 3:2",
    hint: "Weite Landschaft / Ort",
    width: 1152,
    height: 768,
    steps: 4,
    stylePrefix:
      "Cinematic environment illustration, wide landscape 3:2, painterly digital art, atmospheric depth, rich lighting, no text, no watermark, ",
    optimizeHint:
      "wide environment scene, depth and atmosphere, location storytelling",
  },
  {
    id: "banner",
    label: "Banner 16:9",
    hint: "Breites Key-Art / Header",
    width: 1344,
    height: 768,
    steps: 4,
    stylePrefix:
      "Cinematic wide banner illustration, 16:9 aspect ratio, epic composition, painterly digital art, rich lighting, no text, no logos, no watermark, ",
    optimizeHint:
      "wide cinematic key art, left-to-right composition with clear hero subject",
  },
  {
    id: "square",
    label: "Quadrat 1:1",
    hint: "Allgemeines Motiv",
    width: 768,
    height: 768,
    steps: 4,
    stylePrefix:
      "Illustration, square 1:1, painterly cinematic digital art, rich lighting, no text, no watermark, ",
    optimizeHint: "balanced square composition, single clear subject",
  },
  {
    id: "thumbnail",
    label: "Vorschau 1:1",
    hint: "Klein & schnell (512 px)",
    width: 512,
    height: 512,
    steps: 3,
    stylePrefix:
      "Illustration, square 1:1, painterly digital art, clear focal subject, no text, no watermark, ",
    optimizeHint:
      "simple bold composition, one focal subject, readable when small",
  },
];

export function getPreset(id: ImageFormatId): ImageFormatPreset {
  return IMAGE_FORMAT_PRESETS.find((p) => p.id === id) ?? IMAGE_FORMAT_PRESETS[0];
}

export function withStylePrefix(formatId: ImageFormatId, userPrompt: string): string {
  const trimmed = userPrompt.trim();
  const prefix = getPreset(formatId).stylePrefix;
  if (!trimmed) return prefix.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("audiobook cover") ||
    lower.startsWith("book cover") ||
    lower.startsWith("character portrait") ||
    lower.startsWith("cinematic environment") ||
    lower.startsWith("cinematic wide banner") ||
    lower.startsWith("illustration,")
  ) {
    return trimmed;
  }
  return `${prefix}${trimmed}`;
}

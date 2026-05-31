import type { CharacterRow } from "@/lib/db/stories";
import { speakerTtsLabel } from "@/lib/tts/speakerTtsName";

const SLUG_LABELS: Record<string, string> = {
  narrator: "Narrator",
};

export function speakerDisplayName(
  slug: string | null | undefined,
  cast: CharacterRow[],
): string {
  if (!slug || slug === "narrator") return SLUG_LABELS.narrator;
  const c = cast.find((row) => row.slug === slug);
  return c?.name ?? slug;
}

/** Short Kokoro-friendly label from a card name — not the full card title. */
export function speakerTtsName(
  slug: string | null | undefined,
  cast: CharacterRow[],
): string {
  if (!slug || slug === "narrator") return SLUG_LABELS.narrator;
  const c = cast.find((row) => row.slug === slug);
  if (!c?.name?.trim()) return slug;
  return speakerTtsLabel(c.name);
}

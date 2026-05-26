import type { CharacterRow } from "@/lib/db/stories";

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

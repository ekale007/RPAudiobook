export interface StoryPin {
  id: string;
  text: string;
  createdAt: string;
}

export function parseStoryPins(raw: unknown): StoryPin[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (p): p is StoryPin =>
        !!p &&
        typeof p === "object" &&
        typeof (p as StoryPin).id === "string" &&
        typeof (p as StoryPin).text === "string",
    )
    .map((p) => ({
      id: p.id,
      text: p.text.trim(),
      createdAt:
        typeof p.createdAt === "string"
          ? p.createdAt
          : new Date().toISOString(),
    }))
    .filter((p) => p.text.length > 0);
}

export function formatPinsForPrompt(pins: StoryPin[] | undefined): string | null {
  if (!pins?.length) return null;
  const lines = [
    "## Pinned story notes (AUTHORITATIVE — do not contradict)",
    "These were pinned by the player for long-term continuity:",
  ];
  for (const p of pins) lines.push(`- ${p.text}`);
  return lines.join("\n");
}

export function newStoryPin(text: string): StoryPin {
  return {
    id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
}

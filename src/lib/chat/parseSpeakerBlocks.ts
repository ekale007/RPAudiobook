export type SpeakerBlock = {
  speakerSlug: string;
  content: string;
};

const SPEAKER_TAG = /<<speaker:([a-z0-9-]+)>>/gi;

/** Split a group-mode assistant reply into per-speaker segments. */
export function parseSpeakerBlocks(text: string): SpeakerBlock[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const tags = [...trimmed.matchAll(SPEAKER_TAG)];
  if (!tags.length) {
    return [{ speakerSlug: "narrator", content: trimmed }];
  }

  const blocks: SpeakerBlock[] = [];
  for (let i = 0; i < tags.length; i++) {
    const slug = tags[i][1].toLowerCase();
    const start = (tags[i].index ?? 0) + tags[i][0].length;
    const end =
      i + 1 < tags.length ? (tags[i + 1].index ?? trimmed.length) : trimmed.length;
    const content = trimmed.slice(start, end).trim();
    if (content) blocks.push({ speakerSlug: slug, content });
  }
  return blocks;
}

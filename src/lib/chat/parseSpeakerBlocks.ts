export type SpeakerBlock = {
  speakerSlug: string;
  content: string;
};

/** Slug inside <<speaker:slug>> — supports guest:zarek, npc:mother, naya-vellen */
const SPEAKER_SLUG = "[a-z0-9][a-z0-9_:-]*";
const SPEAKER_TAG = new RegExp(`<<\\s*speaker\\s*:\\s*(${SPEAKER_SLUG})\\s*>>`, "gi");
/** Model sometimes emits a single angle bracket — treat like a real tag. */
const MALFORMED_SPEAKER_TAG = new RegExp(
  `<\\s*speaker\\s*:\\s*(${SPEAKER_SLUG})\\s*>`,
  "gi",
);
const SPEAKER_TAG_LINE = new RegExp(
  `^\\s*<<\\s*speaker\\s*:\\s*(${SPEAKER_SLUG})\\s*>>\\s*$`,
  "i",
);
const MALFORMED_SPEAKER_TAG_LINE = new RegExp(
  `^\\s*<\\s*speaker\\s*:\\s*(${SPEAKER_SLUG})\\s*>\\s*$`,
  "i",
);

export function hasSpeakerTags(text: string): boolean {
  return new RegExp(`<<\\s*speaker\\s*:\\s*${SPEAKER_SLUG}\\s*>>`, "i").test(
    text,
  );
}

function normalizeTagSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Fix `<speaker:slug>` → `<<speaker:slug>>` before parse/strip. */
export function normalizeMalformedSpeakerTags(text: string): string {
  return text.replace(
    MALFORMED_SPEAKER_TAG,
    (_m, slug: string) => `<<speaker:${normalizeTagSlug(slug)}>>`,
  );
}

/** Lowercase slugs inside tags; keeps guest:name / npc:mother intact. */
export function normalizeSpeakerTags(text: string): string {
  return normalizeMalformedSpeakerTags(text).replace(
    new RegExp(`<<\\s*speaker\\s*:\\s*(${SPEAKER_SLUG})\\s*>>`, "gi"),
    (_m, slug: string) => `<<speaker:${normalizeTagSlug(slug)}>>`,
  );
}

/** Remove all speaker markers from visible / TTS text. */
export function stripSpeakerTags(text: string): string {
  return text
    .replace(SPEAKER_TAG, "")
    .replace(MALFORMED_SPEAKER_TAG, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Collapse repeated tag-only lines and inline duplicate tags (model habit). */
export function collapseConsecutiveSpeakerTags(text: string): string {
  let out = text.replace(
    new RegExp(
      `(<<\\s*speaker\\s*:\\s*${SPEAKER_SLUG}\\s*>>)(\\s*\\1)+`,
      "gi",
    ),
    "$1",
  );

  const lines = out.split("\n");
  const merged: string[] = [];
  let lastTagLine: string | null = null;

  for (const line of lines) {
    const m = line.match(SPEAKER_TAG_LINE) ?? line.match(MALFORMED_SPEAKER_TAG_LINE);
    if (m) {
      const normalized = `<<speaker:${normalizeTagSlug(m[1])}>>`;
      if (normalized === lastTagLine) continue;
      lastTagLine = normalized;
      merged.push(normalized);
      continue;
    }
    lastTagLine = null;
    merged.push(line);
  }

  return merged.join("\n").trim();
}

export function preprocessAssistantMarkup(text: string): string {
  return collapseConsecutiveSpeakerTags(normalizeSpeakerTags(text));
}

/** Split a group-mode assistant reply into per-speaker segments. */
export function parseSpeakerBlocks(text: string): SpeakerBlock[] {
  const trimmed = preprocessAssistantMarkup(text).trim();
  if (!trimmed) return [];

  const tags = [...trimmed.matchAll(SPEAKER_TAG)];
  if (!tags.length) {
    return [{ speakerSlug: "narrator", content: trimmed }];
  }

  const blocks: SpeakerBlock[] = [];
  const firstTagAt = tags[0].index ?? 0;
  if (firstTagAt > 0) {
    const preamble = stripSpeakerTags(trimmed.slice(0, firstTagAt));
    if (preamble) blocks.push({ speakerSlug: "narrator", content: preamble });
  }

  for (let i = 0; i < tags.length; i++) {
    const slug = normalizeTagSlug(tags[i][1]);
    const start = (tags[i].index ?? 0) + tags[i][0].length;
    const end =
      i + 1 < tags.length ? (tags[i + 1].index ?? trimmed.length) : trimmed.length;
    const content = stripSpeakerTags(trimmed.slice(start, end));
    if (content) blocks.push({ speakerSlug: slug, content });
  }
  return blocks;
}

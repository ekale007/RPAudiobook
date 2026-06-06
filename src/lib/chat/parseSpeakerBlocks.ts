export type SpeakerBlock = {
  speakerSlug: string;
  content: string;
};

/** Slug inside <<speaker:slug>> — supports guest:zarek, npc:mother, naya-vellen */
const SPEAKER_SLUG = "[a-z0-9][a-z0-9_:-]*";

/** Canonical form after normalization. */
const SPEAKER_TAG = new RegExp(
  `<<\\s*speaker\\s*:\\s*(${SPEAKER_SLUG})\\s*>>`,
  "gi",
);

/**
 * Model variants: <speaker:x>, <<speaker:x>>, <<<<speaker:x>>>>, etc.
 * Must consume ALL angle brackets — partial <<…>> inside <<<<…>>>> leaves orphans.
 */
const LOOSE_SPEAKER_TAG = new RegExp(
  `<{1,}\\s*speaker\\s*:\\s*(${SPEAKER_SLUG})\\s*>{1,}`,
  "gi",
);

const SPEAKER_TAG_LINE = new RegExp(
  `^\\s*<<\\s*speaker\\s*:\\s*(${SPEAKER_SLUG})\\s*>>\\s*$`,
  "i",
);

const LOOSE_SPEAKER_TAG_LINE = new RegExp(
  `^\\s*<{1,}\\s*speaker\\s*:\\s*(${SPEAKER_SLUG})\\s*>{1,}\\s*$`,
  "i",
);

/** Empty <<>>, <<<>>>, <<<<>>>>, etc. */
const EMPTY_ANGLE_TAG = /<{2,}\s*>{1,}/g;

export function hasSpeakerTags(text: string): boolean {
  return new RegExp(
    `<{1,}\\s*speaker\\s*:\\s*${SPEAKER_SLUG}\\s*>{1,}`,
    "i",
  ).test(text);
}

function normalizeTagSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

function canonicalSpeakerTag(slug: string): string {
  return `<<speaker:${normalizeTagSlug(slug)}>>`;
}

/** Normalize any speaker tag variant to <<speaker:slug>>; strip empty <<>>. */
export function normalizeMalformedSpeakerTags(text: string): string {
  let out = text.replace(
    LOOSE_SPEAKER_TAG,
    (_m, slug: string) => canonicalSpeakerTag(slug),
  );
  out = out.replace(EMPTY_ANGLE_TAG, "");
  return out;
}

/** Lowercase slugs inside tags; keeps guest:name / npc:mother intact. */
export function normalizeSpeakerTags(text: string): string {
  return normalizeMalformedSpeakerTags(text).replace(
    SPEAKER_TAG,
    (_m, slug: string) => canonicalSpeakerTag(slug),
  );
}

/** Leftover >>> or <<< from broken tags before prose lines. */
function stripOrphanBracketNoise(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (
        SPEAKER_TAG_LINE.test(line) ||
        LOOSE_SPEAKER_TAG_LINE.test(line)
      ) {
        return line;
      }
      return line
        .replace(/^\s*>{2,}\s+/, "")
        .replace(/^\s*<{2,}\s+/, "")
        .replace(/\s*<{2,}\s*$/, "")
        .replace(/\s*>{2,}\s*$/, "");
    })
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^<{1,}>?$/.test(t)) return false;
      if (/^>{2,}$/.test(t)) return false;
      if (/^<{2,}$/.test(t)) return false;
      return true;
    })
    .join("\n");
}

/** Remove all speaker markers from visible / TTS text. */
export function stripSpeakerTags(text: string): string {
  return stripOrphanBracketNoise(
    text
      .replace(LOOSE_SPEAKER_TAG, "")
      .replace(EMPTY_ANGLE_TAG, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
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
    const m =
      line.match(SPEAKER_TAG_LINE) ?? line.match(LOOSE_SPEAKER_TAG_LINE);
    if (m) {
      const normalized = canonicalSpeakerTag(m[1]);
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
  return stripOrphanBracketNoise(
    collapseConsecutiveSpeakerTags(normalizeSpeakerTags(text)),
  );
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
      i + 1 < tags.length
        ? (tags[i + 1].index ?? trimmed.length)
        : trimmed.length;
    const content = stripSpeakerTags(trimmed.slice(start, end));
    if (content) blocks.push({ speakerSlug: slug, content });
  }
  return blocks;
}

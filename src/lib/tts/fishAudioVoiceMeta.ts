/** Fish model tags + sample preview helpers. */

const GENDER_LABEL: Record<string, string> = {
  male: "Männlich",
  female: "Weiblich",
  man: "Männlich",
  woman: "Weiblich",
  boy: "Junge",
  girl: "Mädchen",
};

const AGE_LABEL: Record<string, string> = {
  young: "jung",
  teen: "Teen",
  teenager: "Teen",
  "middle aged": "mittel",
  "middle-aged": "mittel",
  middleaged: "mittel",
  adult: "erwachsen",
  old: "alt",
  elderly: "alt",
  senior: "Senior",
};

function normalizeTagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, " ");
}

export function pickFishPreviewUrl(
  samples?: Array<{ audio?: string }> | null,
): string | null {
  for (const sample of samples ?? []) {
    const raw = sample.audio?.trim();
    if (!raw) continue;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("//")) return `https:${raw}`;
    if (raw.startsWith("/")) return `https://fish.audio${raw}`;
  }
  return null;
}

/** Tags from Fish API → short German hint (Geschlecht, Alter, Rest). */
export function formatFishVoiceTagLine(tags?: string[] | null): string {
  if (!tags?.length) return "";
  const seen = new Set<string>();
  const ordered: string[] = [];
  const extras: string[] = [];

  for (const raw of tags) {
    const key = normalizeTagKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const gender = GENDER_LABEL[key];
    if (gender) {
      ordered.push(gender);
      continue;
    }
    const age = AGE_LABEL[key];
    if (age) {
      ordered.push(age);
      continue;
    }
    extras.push(raw.trim());
  }

  const parts = [...ordered, ...extras.slice(0, 4)];
  return parts.join(" · ");
}

export function buildFishVoiceHint(args: {
  languages: string[];
  state: string;
  tags?: string[] | null;
}): string {
  const parts: string[] = [];
  const tagLine = formatFishVoiceTagLine(args.tags);
  if (tagLine) parts.push(tagLine);
  const langs = args.languages.filter(Boolean);
  if (langs.length) parts.push(langs.join(", "));
  const state = args.state?.trim();
  if (state && state !== "trained") parts.push(state);
  return parts.join(" · ") || "Stimme";
}

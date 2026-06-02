import type { StoryContentLocale } from "@/lib/story/protagonist";

/** Quote + thought patterns per story language. */
export function extractMarkedSnippets(
  text: string,
  locale: StoryContentLocale = "en",
): string[] {
  const out: string[] = [];
  const patterns =
    locale === "de" ? germanQuotePatterns() : englishQuotePatterns();

  for (const quoteRe of patterns) {
    for (const m of text.matchAll(quoteRe)) out.push(m[0]);
  }

  const thoughtRe = /\*([^*\n]+)\*/g;
  for (const m of text.matchAll(thoughtRe)) {
    const inner = (m[1] ?? "").trim();
    if (!isDialogueLikeThought(inner, locale)) continue;
    out.push(m[0]);
  }

  const uniq = new Set<string>();
  return out.filter((s) => {
    const key = s.trim();
    if (!key || uniq.has(key)) return false;
    uniq.add(key);
    return true;
  });
}

function germanQuotePatterns(): RegExp[] {
  return [
    // DE „…" / „…" (non-greedy; closing U+201C, U+201D, or ASCII ")
    /„[^„\n]{2,260}?[\u201C\u201D"]/g,
    // English-style curly in German text
    /[""][^"""\n]{2,260}["""]/g,
    /["“][^"”\n]{2,260}["”]/g,
    /«[^»\n]{2,260}»/g,
  ];
}

function englishQuotePatterns(): RegExp[] {
  return [
    /[""][^"""\n]{2,260}["""]/g,
    /["“][^"”\n]{2,260}["”]/g,
    /„[^„"\n]{2,260}[\u201C"]/g,
  ];
}

function isDialogueLikeThought(
  inner: string,
  locale: StoryContentLocale,
): boolean {
  const t = inner.trim();
  if (t.length < 10) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return true;
  if (locale === "de") {
    return /\b(ich|du|wir|ihr|sie|man|warum|wieso|wie|nie|immer|doch)\b/i.test(
      t,
    );
  }
  return /\b(I|I'm|I've|you|we|they|never|always|why|how)\b/i.test(t);
}

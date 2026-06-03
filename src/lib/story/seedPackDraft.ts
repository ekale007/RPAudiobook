import { mergeLoreEntries, type StorySeedPack } from "@/lib/import/storySeed";
import type { StoryDraft } from "@/lib/story/generateStoryDraft";
import type { StoryCharacterCard } from "@/lib/types";

function cloneCard(card: StoryCharacterCard): StoryCharacterCard {
  return structuredClone(card);
}

export function seedPackToStoryDraft(
  pack: StorySeedPack,
  meta: {
    storyTitle: string;
    bandTitle: string;
    chapterTitle: string;
    phaseHint?: string;
    locale: string;
    lorebookName?: string;
  },
): StoryDraft {
  const books = pack.lorebooks.map((l) => l.book);
  const entries = mergeLoreEntries(books);
  return {
    storyTitle: meta.storyTitle,
    locale: meta.locale,
    bandTitle: meta.bandTitle,
    chapterTitle: meta.chapterTitle,
    phaseHint: meta.phaseHint,
    worldLorebook: {
      name:
        meta.lorebookName ??
        books.map((b) => b.name).join(" · ") ??
        "World Bible",
      description: books[0]?.description,
      entries: entries.map((e, idx) => ({
        ...e,
        order: e.order ?? (idx + 1) * 10,
        position: e.position ?? 0,
        enabled: e.enabled ?? true,
      })),
    },
    characters: pack.characters.map((c) => ({
      slug: c.slug,
      role: c.role,
      card: cloneCard(c.card),
    })),
  };
}

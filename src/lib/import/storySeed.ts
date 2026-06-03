import type { StoryCharacterCard, StoryLorebook } from "@/lib/types";

import narratorCard from "@/data/seed/library/characters/when-dawn-breaks-narrator.json";
import nayaCard from "@/data/seed/library/characters/naya-vellen.json";
import kaelenCard from "@/data/seed/library/characters/kaelen-vellen.json";
import luciferCard from "@/data/seed/library/characters/lucifer.json";
import michaelCard from "@/data/seed/library/characters/michael.json";
import gabrielCard from "@/data/seed/library/characters/gabriel.json";
import hiddenCommunityCard from "@/data/seed/library/characters/hidden-community.json";
import worldInfoBook from "@/data/seed/library/lorebooks/world-info.json";
import rothFamilyBook from "@/data/seed/library/lorebooks/roth-family.json";

export interface StorySeedPack {
  characters: Array<{
    slug: string;
    role: "narrator" | "cast";
    card: StoryCharacterCard;
  }>;
  lorebooks: Array<{ slug: string; book: StoryLorebook }>;
}

/** Bundled seed for "When Dawn Breaks" — no HTTP fetch */
export function loadWhenDawnBreaksSeed(): StorySeedPack {
  return {
    characters: [
      { slug: "narrator", role: "narrator", card: narratorCard as StoryCharacterCard },
      { slug: "naya-vellen", role: "cast", card: nayaCard as StoryCharacterCard },
      { slug: "kaelen-vellen", role: "cast", card: kaelenCard as StoryCharacterCard },
      { slug: "lucifer", role: "cast", card: luciferCard as StoryCharacterCard },
      { slug: "michael", role: "cast", card: michaelCard as StoryCharacterCard },
      { slug: "gabriel", role: "cast", card: gabrielCard as StoryCharacterCard },
      {
        slug: "hidden-community",
        role: "cast",
        card: hiddenCommunityCard as StoryCharacterCard,
      },
    ],
    lorebooks: [
      { slug: "world-info", book: worldInfoBook as StoryLorebook },
      { slug: "roth-family", book: rothFamilyBook as StoryLorebook },
    ],
  };
}

export function mergeLoreEntries(
  books: StoryLorebook[],
): StoryLorebook["entries"] {
  return books.flatMap((b) =>
    b.entries.map((e) => ({ ...e, enabled: e.enabled ?? true })),
  );
}

export function parseUploadedCharacter(json: unknown): StoryCharacterCard {
  const o = json as StoryCharacterCard;
  if (!o?.name) throw new Error("Invalid character card: missing name");
  return o;
}

export function parseUploadedLorebook(json: unknown): StoryLorebook {
  const o = json as StoryLorebook;
  if (!o?.entries?.length) throw new Error("Invalid lorebook: missing entries");
  return o;
}

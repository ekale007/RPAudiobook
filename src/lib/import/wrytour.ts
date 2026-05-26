import type { WryTourCharacter, WryTourLorebook } from "@/lib/types";

import narratorCard from "@/data/seed/wrytour/characters/when-dawn-breaks-narrator.json";
import nayaCard from "@/data/seed/wrytour/characters/naya-vellen.json";
import kaelenCard from "@/data/seed/wrytour/characters/kaelen-vellen.json";
import luciferCard from "@/data/seed/wrytour/characters/lucifer.json";
import michaelCard from "@/data/seed/wrytour/characters/michael.json";
import gabrielCard from "@/data/seed/wrytour/characters/gabriel.json";
import mayaCard from "@/data/seed/wrytour/characters/maya-roth.json";
import hiddenCommunityCard from "@/data/seed/wrytour/characters/hidden-community.json";
import worldInfoBook from "@/data/seed/wrytour/lorebooks/world-info.json";
import rothFamilyBook from "@/data/seed/wrytour/lorebooks/roth-family.json";

export interface WryTourSeedPack {
  characters: Array<{ slug: string; role: "narrator" | "cast"; card: WryTourCharacter }>;
  lorebooks: Array<{ slug: string; book: WryTourLorebook }>;
}

/** Bundled seed — no HTTP fetch, works in dev and production */
export function loadWhenDawnBreaksSeed(): WryTourSeedPack {
  return {
    characters: [
      { slug: "narrator", role: "narrator", card: narratorCard as WryTourCharacter },
      { slug: "naya-vellen", role: "cast", card: nayaCard as WryTourCharacter },
      { slug: "kaelen-vellen", role: "cast", card: kaelenCard as WryTourCharacter },
      { slug: "lucifer", role: "cast", card: luciferCard as WryTourCharacter },
      { slug: "michael", role: "cast", card: michaelCard as WryTourCharacter },
      { slug: "gabriel", role: "cast", card: gabrielCard as WryTourCharacter },
      { slug: "maya-roth", role: "cast", card: mayaCard as WryTourCharacter },
      {
        slug: "hidden-community",
        role: "cast",
        card: hiddenCommunityCard as WryTourCharacter,
      },
    ],
    lorebooks: [
      { slug: "world-info", book: worldInfoBook as WryTourLorebook },
      { slug: "roth-family", book: rothFamilyBook as WryTourLorebook },
    ],
  };
}

export function mergeLoreEntries(
  books: WryTourLorebook[],
): WryTourLorebook["entries"] {
  return books.flatMap((b) =>
    b.entries.map((e) => ({ ...e, enabled: e.enabled ?? true })),
  );
}

export function parseUploadedCharacter(json: unknown): WryTourCharacter {
  const o = json as WryTourCharacter;
  if (!o?.name) throw new Error("Invalid character card: missing name");
  return o;
}

export function parseUploadedLorebook(json: unknown): WryTourLorebook {
  const o = json as WryTourLorebook;
  if (!o?.entries?.length) throw new Error("Invalid lorebook: missing entries");
  return o;
}

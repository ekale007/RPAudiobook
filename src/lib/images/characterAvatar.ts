import type { StoryCharacterCard } from "@/lib/types";

export const HOERBUCHKI_EXT_KEY = "hoerbuchki";

export type HoerbuchkiCharacterExtensions = {
  avatarStoragePath?: string | null;
};

export function getHoerbuchkiExtensions(
  card: StoryCharacterCard,
): HoerbuchkiCharacterExtensions {
  const raw = card.extensions?.[HOERBUCHKI_EXT_KEY];
  if (!raw || typeof raw !== "object") return {};
  const ext = raw as HoerbuchkiCharacterExtensions;
  return {
    avatarStoragePath:
      typeof ext.avatarStoragePath === "string" ? ext.avatarStoragePath : null,
  };
}

export function setAvatarStoragePath(
  card: StoryCharacterCard,
  storagePath: string | null,
): StoryCharacterCard {
  const prev = getHoerbuchkiExtensions(card);
  const nextExt: HoerbuchkiCharacterExtensions = {
    ...prev,
    avatarStoragePath: storagePath,
  };
  return {
    ...card,
    extensions: {
      ...(card.extensions ?? {}),
      [HOERBUCHKI_EXT_KEY]: nextExt,
    },
  };
}

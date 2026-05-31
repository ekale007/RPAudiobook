import type { WryTourCharacter } from "@/lib/types";

export const HOERBUCHKI_EXT_KEY = "hoerbuchki";

export type HoerbuchkiCharacterExtensions = {
  avatarStoragePath?: string | null;
};

export function getHoerbuchkiExtensions(
  card: WryTourCharacter,
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
  card: WryTourCharacter,
  storagePath: string | null,
): WryTourCharacter {
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

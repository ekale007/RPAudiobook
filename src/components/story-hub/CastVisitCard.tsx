"use client";

import { CharacterAvatar } from "@/components/CharacterAvatar";
import { getHoerbuchkiExtensions } from "@/lib/images/characterAvatar";
import type { CharacterRow } from "@/lib/db/stories";
import type { StoryCharacterCard } from "@/lib/types";

export function CastVisitCard({
  character,
  archived,
  isNarrator,
  voiceLabel,
  onClick,
}: {
  character: CharacterRow;
  archived: boolean;
  isNarrator: boolean;
  voiceLabel?: string | null;
  onClick: () => void;
}) {
  const card = character.card_json;
  const tagline =
    card.personality?.trim() ||
    card.description?.trim() ||
    character.character_memory?.trim()?.slice(0, 80) ||
    null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex aspect-[5/3] min-h-[108px] w-full flex-col overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 ${
        archived
          ? "border-zinc-700/80 bg-zinc-900/50 opacity-75"
          : isNarrator
            ? "border-accent/25 bg-gradient-to-br from-accent/10 via-surface-raised to-surface-raised hover:border-accent/40"
            : "border-surface-border bg-gradient-to-br from-surface-raised to-zinc-900/80 hover:border-accent/30"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.04),transparent_55%)]" />

      <div className="relative flex flex-1 flex-col p-2.5">
        <div className="flex items-start gap-2">
          <CharacterAvatar
            name={character.name}
            avatarStoragePath={
              getHoerbuchkiExtensions(card as StoryCharacterCard).avatarStoragePath
            }
            className="h-9 w-9 ring-2 ring-surface-border/80"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-zinc-50">
              {character.name}
            </p>
            <p
              className={`mt-0.5 text-[9px] font-medium uppercase tracking-wide ${
                isNarrator ? "text-accent" : archived ? "text-zinc-600" : "text-zinc-500"
              }`}
            >
              {isNarrator ? "Erzähler" : archived ? "Archiv" : "Cast"}
            </p>
          </div>
        </div>

        {tagline ? (
          <p className="mt-2 line-clamp-2 flex-1 text-[10px] leading-snug text-zinc-400 group-hover:text-zinc-300">
            {tagline}
          </p>
        ) : (
          <p className="mt-2 flex-1 text-[10px] italic text-zinc-600">
            Noch kein Profil
          </p>
        )}

        {voiceLabel ? (
          <p className="mt-1 truncate text-[9px] text-zinc-600">
            ♪ {voiceLabel}
          </p>
        ) : null}
      </div>
    </button>
  );
}

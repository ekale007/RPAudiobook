"use client";

import { useRef, useState } from "react";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { uploadCharacterAvatar } from "@/lib/db/characterAvatarStorage";
import { getHoerbuchkiExtensions, setAvatarStoragePath } from "@/lib/images/characterAvatar";
import { updateCharacterCard } from "@/lib/db/stories";
import type { StoryCharacterCard } from "@/lib/types";

export function CharacterAvatarUpload({
  userId,
  storyId,
  characterId,
  name,
  card,
  onUpdated,
  onPersisted,
  compact = false,
}: {
  userId: string;
  storyId: string;
  characterId: string;
  name: string;
  card: StoryCharacterCard;
  onUpdated: (card: StoryCharacterCard) => void;
  onPersisted?: () => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarPath = getHoerbuchkiExtensions(card).avatarStoragePath;

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Bitte JPG, PNG oder WebP wählen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = await uploadCharacterAvatar(
        userId,
        storyId,
        characterId,
        file,
      );
      if (!path) throw new Error("Upload fehlgeschlagen");
      const nextCard = setAvatarStoragePath(card, path);
      await updateCharacterCard(characterId, storyId, nextCard);
      onUpdated(nextCard);
      onPersisted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removePhoto = async () => {
    setBusy(true);
    setError(null);
    try {
      const nextCard = setAvatarStoragePath(card, null);
      await updateCharacterCard(characterId, storyId, nextCard);
      onUpdated(nextCard);
      onPersisted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? "flex items-center gap-3" : "space-y-2"}>
      <CharacterAvatar
        name={name}
        avatarStoragePath={avatarPath}
        className={compact ? "h-14 w-14" : "h-16 w-16"}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-surface-border px-2.5 py-1 text-[11px] text-zinc-300 hover:border-accent/40 disabled:opacity-40"
          >
            {busy ? "…" : avatarPath ? "Foto ersetzen" : "Foto hochladen"}
          </button>
          {avatarPath ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void removePhoto()}
              className="rounded-lg border border-surface-border px-2.5 py-1 text-[11px] text-zinc-500 hover:text-red-400 disabled:opacity-40"
            >
              Entfernen
            </button>
          ) : null}
        </div>
        <p className="text-[10px] text-zinc-600">
          JPG, PNG oder WebP · max. 5 MB · GPU-Porträt: Ordner{" "}
          <code className="text-zinc-500">image-studio/</code>
        </p>
        {error ? <p className="text-[10px] text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}

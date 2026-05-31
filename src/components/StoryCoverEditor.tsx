"use client";

import { useRef, useState } from "react";
import {
  setStoryCoverPath,
  uploadStoryCover,
} from "@/lib/db/storyCoverStorage";
import { StoryCover } from "@/components/StoryCover";
import { getLibraryTemplateId } from "@/lib/story/storyOrigin";

export function StoryCoverEditor({
  storyId,
  userId,
  title,
  coverStoragePath,
  settings,
  onUpdated,
  compact = false,
  merged = false,
  description,
  editingTitle = false,
  titleDraft = "",
  titleBusy = false,
  onStartRename,
  onTitleDraftChange,
  onSaveTitle,
  onCancelRename,
}: {
  storyId: string;
  userId: string;
  title: string;
  coverStoragePath?: string | null;
  settings: Record<string, unknown>;
  onUpdated: (path: string | null) => void;
  compact?: boolean;
  merged?: boolean;
  description?: string | null;
  editingTitle?: boolean;
  titleDraft?: string;
  titleBusy?: boolean;
  onStartRename?: () => void;
  onTitleDraftChange?: (v: string) => void;
  onSaveTitle?: () => void;
  onCancelRename?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const libraryTemplateId = getLibraryTemplateId(settings);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Bitte ein Bild (JPG, PNG oder WebP) wählen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = await uploadStoryCover(userId, storyId, file);
      if (!path) throw new Error("Upload fehlgeschlagen");
      await setStoryCoverPath(storyId, path);
      onUpdated(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeCover = async () => {
    setBusy(true);
    setError(null);
    try {
      await setStoryCoverPath(storyId, null);
      onUpdated(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const coverSize = merged
    ? "h-24 w-[4.25rem]"
    : compact
      ? "h-20 w-14"
      : "h-28 w-20";

  const uploadButtons = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent disabled:opacity-50"
        >
          {busy ? "…" : merged ? "Cover" : "Cover hochladen"}
        </button>
        {coverStoragePath ? (
          <button
            type="button"
            disabled={busy}
            onClick={removeCover}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 disabled:opacity-50"
          >
            Entfernen
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </>
  );

  if (merged) {
    return (
      <section className="rounded-lg border border-surface-border bg-surface-raised p-2.5">
        <h2 className="mb-2 text-xs font-medium text-zinc-400">
          Cover & Summary
        </h2>
        <div className="flex gap-2.5">
          <StoryCover
            title={title}
            coverStoragePath={coverStoragePath}
            libraryTemplateId={libraryTemplateId}
            className={`${coverSize} shrink-0`}
            aspectClass={`aspect-auto ${coverSize}`}
          />
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <div className="flex flex-col gap-1.5">
                <input
                  value={titleDraft}
                  onChange={(e) => onTitleDraftChange?.(e.target.value)}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={titleBusy}
                    onClick={onSaveTitle}
                    className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-black disabled:opacity-50"
                  >
                    {titleBusy ? "…" : "Speichern"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelRename}
                    className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-400"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug text-zinc-100">
                    {title}
                  </p>
                  <button
                    type="button"
                    onClick={onStartRename}
                    className="shrink-0 text-[10px] text-accent underline"
                  >
                    Umbenennen
                  </button>
                </div>
                {description ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                    {description}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] italic text-zinc-600">
                    Keine Beschreibung hinterlegt
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="mt-2 border-t border-surface-border/50 pt-2">
          {uploadButtons}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-lg border border-surface-border bg-surface-raised ${
        compact ? "p-2" : "rounded-xl p-3"
      }`}
    >
      <h2 className="mb-1.5 text-xs font-medium text-zinc-500">Cover</h2>
      <div className="flex gap-2.5">
        <StoryCover
          title={title}
          coverStoragePath={coverStoragePath}
          libraryTemplateId={libraryTemplateId}
          className={`${coverSize} shrink-0`}
          aspectClass={`aspect-auto ${coverSize}`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {!compact ? (
            <p className="text-xs leading-relaxed text-zinc-500">
              JPG, PNG oder WebP · max. 5 MB. Ohne Upload wird das
              Bibliotheks-Farbschema genutzt.
            </p>
          ) : null}
          {uploadButtons}
        </div>
      </div>
    </section>
  );
}

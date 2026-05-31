"use client";

import Link from "next/link";
import { LibraryTurntable } from "@/components/LibraryTurntable";
import type { LibraryTemplateId } from "@/lib/story/libraryTemplates";
import { StoryCover } from "@/components/StoryCover";

export function StoryLibraryShelf({
  importingId,
  onImport,
}: {
  importingId: LibraryTemplateId | null;
  onImport: (id: LibraryTemplateId) => void;
}) {
  return <LibraryTurntable importingId={importingId} onImport={onImport} />;
}

export function StoryListCard({
  story,
  libraryTemplateId,
  originLabel,
  busy,
  renaming,
  renameDraft,
  onRenameDraftChange,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onArchive,
  onDelete,
  isArchived,
}: {
  story: { id: string; title: string; cover_storage_path?: string | null };
  libraryTemplateId: string | null;
  originLabel: string;
  busy: boolean;
  renaming: boolean;
  renameDraft: string;
  onRenameDraftChange: (v: string) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onSaveRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isArchived: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-raised">
      <div className="flex gap-2 p-2">
        <StoryCover
          title={story.title}
          coverStoragePath={story.cover_storage_path}
          libraryTemplateId={libraryTemplateId}
          className="h-11 w-8 shrink-0 rounded-md"
          aspectClass="aspect-auto h-11 w-8"
          compact
        />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex flex-col gap-1.5">
              <input
                value={renameDraft}
                onChange={(e) => onRenameDraftChange(e.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                autoFocus
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSaveRename}
                  className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-black disabled:opacity-50"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={onCancelRename}
                  className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <Link href={`/story/${story.id}`} className="block py-0.5">
              <span className="text-sm font-medium leading-tight text-zinc-100">
                {story.title}
              </span>
              <span className="mt-0.5 block text-[10px] text-zinc-500">
                {originLabel}
              </span>
            </Link>
          )}
        </div>
      </div>
      {renaming ? null : (
        <div className="flex flex-wrap gap-1 border-t border-surface-border/50 px-2 py-1.5">
          <button
            type="button"
            className="rounded-md border border-zinc-700/80 px-1.5 py-0.5 text-[10px] text-zinc-400"
            onClick={onStartRename}
          >
            Umbenennen
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-md border border-zinc-700/80 px-1.5 py-0.5 text-[10px] text-zinc-400 disabled:opacity-50"
            onClick={onArchive}
          >
            {isArchived ? "Restore" : "Archive"}
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-md border border-red-900/50 px-1.5 py-0.5 text-[10px] text-red-400/90 disabled:opacity-50"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

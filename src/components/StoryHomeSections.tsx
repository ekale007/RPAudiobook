"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PUBLIC_LIBRARY_TEMPLATES,
  type LibraryTemplateId,
} from "@/lib/story/libraryTemplates";
import { StoryCover } from "@/components/StoryCover";

type LibraryTemplate = (typeof PUBLIC_LIBRARY_TEMPLATES)[number];

function LibraryBookPanel({
  template,
  importing,
  onImport,
  className = "",
}: {
  template: LibraryTemplate;
  importing: boolean;
  onImport: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex overflow-hidden rounded-lg border border-surface-border bg-surface-raised/95 shadow-xl shadow-black/50 backdrop-blur-sm ${className}`}
    >
      <StoryCover
        title={template.title}
        libraryTemplateId={template.id}
        coverImageSrc={template.coverImageSrc}
        aspectClass="aspect-[2/3] w-[8.25rem] shrink-0 sm:w-36"
        className="rounded-none border-0"
      />
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <h3 className="text-sm font-semibold leading-snug text-zinc-100">
          {template.title}
        </h3>
        <p className="mt-0.5 text-xs leading-snug text-zinc-500">
          {template.tagline}
        </p>
        <p className="mt-2 line-clamp-4 flex-1 text-xs leading-relaxed text-zinc-400">
          {template.defaultConcept}
        </p>
        <button
          type="button"
          disabled={importing}
          onClick={onImport}
          className="mt-2 w-full touch-manipulation rounded-md border border-accent/40 bg-accent/15 py-2 text-xs font-medium text-accent disabled:opacity-50"
        >
          {importing ? "Importiert …" : "Importieren"}
        </button>
      </div>
    </div>
  );
}

function LibraryBookSpine({
  template,
  expanded,
  onToggle,
  onImport,
  importing,
}: {
  template: LibraryTemplate;
  importing: boolean;
  expanded: boolean;
  onToggle: () => void;
  onImport: () => void;
}) {
  const panelVisible = expanded;
  const spineLabel = template.spineTitle ?? template.title;

  return (
    <div className="group/spine relative shrink-0 md:group-hover/spine:z-40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={panelVisible}
        aria-label={`${template.title} — Infos anzeigen`}
        className={`library-book-spine relative z-20 flex h-[10.5rem] w-[3.375rem] touch-manipulation flex-col items-center justify-center overflow-hidden rounded-sm border border-black/40 px-0.5 py-3 shadow-md sm:h-[12rem] sm:w-[3.75rem] ${
          panelVisible ? "ring-1 ring-accent/50" : ""
        } md:group-hover/spine:ring-1 md:group-hover/spine:ring-accent/40`}
        style={{ background: template.coverGradient }}
      >
        <span className="library-spine-texture pointer-events-none absolute inset-0" aria-hidden />
        <span className="library-spine-edge library-spine-edge--left" aria-hidden />
        <span className="library-spine-edge library-spine-edge--right" aria-hidden />
        <span className="library-spine-rule library-spine-rule--top" aria-hidden />
        <span className="library-spine-rule library-spine-rule--bottom" aria-hidden />
        <span
          className="library-spine-title relative z-[1] max-h-full px-0.5 text-[12px] font-semibold leading-tight tracking-wide text-amber-50/95 sm:text-[13px]"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
          }}
        >
          {spineLabel}
        </span>
      </button>

      <div
        className={`library-book-panel absolute bottom-full left-1/2 z-50 mb-3 hidden w-[min(28.5rem,92vw)] -translate-x-1/2 transition-all duration-200 sm:w-[26.25rem] md:block ${
          panelVisible
            ? "pointer-events-auto visible scale-100 opacity-100"
            : "pointer-events-none invisible scale-95 opacity-0 md:group-hover/spine:pointer-events-auto md:group-hover/spine:visible md:group-hover/spine:scale-100 md:group-hover/spine:opacity-100"
        }`}
        role="dialog"
        aria-hidden={!panelVisible}
        aria-label={template.title}
      >
        <LibraryBookPanel
          template={template}
          importing={importing}
          onImport={onImport}
        />
      </div>
    </div>
  );
}

export function StoryLibraryShelf({
  importingId,
  onImport,
}: {
  importingId: LibraryTemplateId | null;
  onImport: (id: LibraryTemplateId) => void;
}) {
  const [expandedId, setExpandedId] = useState<LibraryTemplateId | null>(null);
  const expandedTemplate =
    expandedId != null
      ? PUBLIC_LIBRARY_TEMPLATES.find((t) => t.id === expandedId)
      : undefined;

  return (
    <section className="mt-6 flex flex-col gap-2">
      <div className="px-1">
        <h2 className="text-sm font-medium text-zinc-200">Bibliothek</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Tippe ein Buch oder fahre mit der Maus darüber — Cover, Infos, Import.
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl overflow-visible px-2 pt-24 sm:px-4 sm:pt-28">
        <div className="library-shelf relative mx-auto h-[25.5rem] w-full max-w-xl overflow-visible sm:h-[27rem]">
        {expandedTemplate ? (
          <div
            className="absolute inset-x-0 bottom-[calc(1.5rem+10.5rem+0.75rem)] z-50 flex justify-center px-3 sm:bottom-[calc(1.5rem+12rem+0.75rem)] md:hidden"
            role="dialog"
            aria-label={expandedTemplate.title}
          >
            <LibraryBookPanel
              template={expandedTemplate}
              importing={importingId === expandedTemplate.id}
              onImport={() => onImport(expandedTemplate.id)}
              className="w-full max-w-sm"
            />
          </div>
        ) : null}
        <div className="absolute inset-x-2 bottom-6 z-10 flex items-end justify-center gap-3 sm:gap-[1.125rem]">
          {PUBLIC_LIBRARY_TEMPLATES.map((template) => (
            <LibraryBookSpine
              key={template.id}
              template={template}
              importing={importingId === template.id}
              expanded={expandedId === template.id}
              onToggle={() =>
                setExpandedId((id) =>
                  id === template.id ? null : template.id,
                )
              }
              onImport={() => onImport(template.id)}
            />
          ))}
        </div>
        <div
          className="library-shelf-board pointer-events-none absolute inset-x-2 bottom-0 z-0 h-[0.6875rem] rounded-sm border-t border-amber-700/40 shadow-inner"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-8 bottom-0 z-0 h-3 rounded-b-md bg-black/30 blur-[2px]"
          aria-hidden
        />
        </div>
      </div>
    </section>
  );
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

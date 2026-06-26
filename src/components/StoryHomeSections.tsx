"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { LibraryGrid } from "@/components/LibraryGrid";
import type { LibraryTemplateId } from "@/lib/story/libraryTemplates";
import { StoryCover } from "@/components/StoryCover";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import {
  getStoryOrigin,
  storyOriginLabel,
} from "@/lib/story/storyOrigin";
import { ui } from "@/lib/ui/classes";

export function StoryLibraryShelf({
  importingId,
  onImport,
}: {
  importingId: LibraryTemplateId | null;
  onImport: (id: LibraryTemplateId) => void;
}) {
  return <LibraryGrid importingId={importingId} onImport={onImport} />;
}

export function StoryListCard({
  story,
  libraryTemplateId,
  storySettings,
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
  storySettings: unknown;
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
  const { locale, t } = useUiLocale();
  const originLabel = storyOriginLabel(getStoryOrigin(storySettings), locale);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const menuOpen = menuPos !== null;
  const closeMenu = () => setMenuPos(null);
  const openMenu = () => {
    const r = menuBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    setMenuPos({
      top: r.bottom + 4,
      right: Math.max(8, window.innerWidth - r.right),
    });
  };

  if (renaming) {
    return (
      <div className={`${ui.card} flex gap-2.5 p-2`}>
        <StoryCover
          title={story.title}
          coverStoragePath={story.cover_storage_path}
          libraryTemplateId={libraryTemplateId}
          className="h-12 w-9 shrink-0 rounded-md"
          aspectClass="aspect-auto h-12 w-9"
          compact
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input
            value={renameDraft}
            onChange={(e) => onRenameDraftChange(e.target.value)}
            className={ui.input}
            autoFocus
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={onSaveRename}
              className={ui.btnPrimary}
            >
              {busy ? "…" : t("story.save")}
            </button>
            <button type="button" onClick={onCancelRename} className={ui.btn}>
              {t("story.cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${ui.card} flex items-stretch`}>
      <Link
        href={`/story/${story.id}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 p-2 transition active:scale-[0.99]"
      >
        <StoryCover
          title={story.title}
          coverStoragePath={story.cover_storage_path}
          libraryTemplateId={libraryTemplateId}
          className="h-12 w-9 shrink-0 rounded-md"
          aspectClass="aspect-auto h-12 w-9"
          compact
        />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight text-zinc-100">
            {story.title}
          </span>
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-zinc-500">
            <span className={ui.chip}>{originLabel}</span>
            {isArchived ? (
              <span className={ui.chip}>{t("story.archive")}</span>
            ) : null}
          </span>
        </div>
        <span className="shrink-0 text-base text-zinc-600" aria-hidden>
          ›
        </span>
      </Link>

      <div className="flex items-center pr-1">
        <button
          ref={menuBtnRef}
          type="button"
          aria-label={t("home.manage")}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => (menuOpen ? closeMenu() : openMenu())}
          className={ui.iconBtn}
        >
          <span className="text-lg leading-none" aria-hidden>
            ⋯
          </span>
        </button>
      </div>

      {menuOpen && menuPos ? (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={closeMenu}
          />
          <div
            className="fixed z-50 min-w-[9rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-surface-border bg-surface-raised shadow-lg shadow-black/40"
            style={{ top: menuPos.top, right: menuPos.right }}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className={ui.menuItem}
              onClick={() => {
                closeMenu();
                onStartRename();
              }}
            >
              {t("story.rename")}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              className={ui.menuItem}
              onClick={() => {
                closeMenu();
                onArchive();
              }}
            >
              {isArchived ? t("story.restore") : t("story.archive")}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              className={ui.menuItemDanger}
              onClick={() => {
                closeMenu();
                onDelete();
              }}
            >
              {t("story.delete")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

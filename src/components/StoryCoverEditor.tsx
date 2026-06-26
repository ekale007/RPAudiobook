"use client";

import { useRef, useState } from "react";
import {
  setStoryCoverPath,
  uploadStoryCover,
} from "@/lib/db/storyCoverStorage";
import { StoryCover } from "@/components/StoryCover";
import { getLibraryTemplateId } from "@/lib/story/storyOrigin";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { ui } from "@/lib/ui/classes";

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
  const { t } = useUiLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(!merged);
  const libraryTemplateId = getLibraryTemplateId(settings);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("cover.invalidType"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = await uploadStoryCover(userId, storyId, file);
      if (!path) throw new Error(t("cover.uploadFailed"));
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
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={ui.btnAccent}
        >
          {busy ? "…" : t("cover.upload")}
        </button>
        {coverStoragePath ? (
          <button
            type="button"
            disabled={busy}
            onClick={removeCover}
            className={ui.btn}
          >
            {t("cover.remove")}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </>
  );

  if (merged) {
    return (
      <section className={`${ui.card} p-2.5`}>
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
                  className={ui.input}
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={titleBusy}
                    onClick={onSaveTitle}
                    className={ui.btnPrimary}
                  >
                    {titleBusy ? "…" : t("story.save")}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelRename}
                    className={ui.btn}
                  >
                    {t("story.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug text-zinc-100">
                    {title}
                  </p>
                  <button
                    type="button"
                    onClick={onStartRename}
                    className="shrink-0 text-[10px] text-accent hover:underline"
                  >
                    {t("story.rename")}
                  </button>
                </div>
                {description ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                    {description}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] italic text-zinc-600">
                    {t("cover.noDescription")}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowUpload((v) => !v)}
                  className="mt-1.5 text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  {t("cover.change")} {showUpload ? "▲" : "▾"}
                </button>
              </>
            )}
          </div>
        </div>
        {showUpload && !editingTitle ? (
          <div className="mt-2 border-t border-surface-border/50 pt-2">
            {uploadButtons}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className={`${ui.card} ${compact ? "p-2" : "p-3"}`}>
      <h2 className={`mb-1.5 ${ui.label}`}>{t("cover.title")}</h2>
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
              {t("cover.uploadHint")}
            </p>
          ) : null}
          {uploadButtons}
        </div>
      </div>
    </section>
  );
}

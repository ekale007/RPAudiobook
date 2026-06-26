"use client";

import Link from "next/link";
import { OverlayPanel } from "@/components/ui/OverlayPanel";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

export function LibraryDuplicateImportModal({
  open,
  storyTitle,
  storyId,
  onClose,
  onNewPlaythrough,
}: {
  open: boolean;
  storyTitle: string;
  storyId: string;
  onClose: () => void;
  onNewPlaythrough: () => void;
}) {
  const { t } = useUiLocale();

  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      title={t("library.duplicateTitle")}
      wide
    >
      <p className="mb-4 text-sm text-zinc-300">
        {t("library.duplicateBody", { title: storyTitle })}
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onNewPlaythrough}
          className="rounded-xl bg-accent py-2.5 text-sm font-medium text-zinc-950"
        >
          {t("library.duplicateNewPlaythrough")}
        </button>
        <Link
          href={`/story/${storyId}`}
          className="rounded-xl border border-surface-border py-2.5 text-center text-sm text-zinc-300"
        >
          {t("library.duplicateOpen")}
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-transparent py-2 text-sm text-zinc-500"
        >
          {t("library.duplicateDismiss")}
        </button>
      </div>
    </OverlayPanel>
  );
}

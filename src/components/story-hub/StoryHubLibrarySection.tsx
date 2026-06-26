"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LibraryImportProtagonistModal } from "@/components/story-hub/LibraryImportProtagonistModal";
import {
  importFromLibraryTemplate,
  listLibraryImportStories,
  type StoryProtagonistImportSetup,
} from "@/lib/db/stories";
import type { LibraryTemplateId } from "@/lib/story/libraryTemplates";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { ui } from "@/lib/ui/classes";

export function StoryHubLibrarySection({
  storyId,
  userId,
  templateId,
  templateTitle,
}: {
  storyId: string;
  userId: string;
  templateId: LibraryTemplateId;
  templateTitle: string;
}) {
  const { t } = useUiLocale();
  const router = useRouter();
  const [playthroughs, setPlaythroughs] = useState<
    { id: string; title: string; archived: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await listLibraryImportStories(templateId);
    setPlaythroughs(rows.filter((r) => !r.archived));
  }, [templateId]);

  useEffect(() => {
    load()
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [load]);

  const runImport = async (setup: StoryProtagonistImportSetup) => {
    setImportBusy(true);
    setError(null);
    try {
      const { storyId: newId } = await importFromLibraryTemplate(
        userId,
        templateId,
        setup,
      );
      setImportOpen(false);
      router.push(`/story/${newId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setImportBusy(false);
    }
  };

  const others = playthroughs.filter((p) => p.id !== storyId);

  return (
    <>
      <section className={`${ui.panel} border-accent/25 bg-accent/[0.04] p-2.5`}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[10px] font-medium uppercase tracking-wide text-accent">
              {t("storyHub.playthroughsTitle")}
            </h2>
            <p className="mt-0.5 text-[11px] text-zinc-400">{templateTitle}</p>
          </div>
          <button
            type="button"
            disabled={importBusy}
            onClick={() => setImportOpen(true)}
            className={ui.btnAccent}
          >
            {importBusy ? t("library.importing") : t("storyHub.newPlaythrough")}
          </button>
        </div>

        {loading ? (
          <p className="text-[11px] text-zinc-500">{t("common.loading")}</p>
        ) : others.length === 0 ? (
          <p className="text-[11px] text-zinc-500">
            {t("storyHub.playthroughsEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {others.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/story/${p.id}`}
                  className={`${ui.card} flex items-center justify-between gap-2 px-2.5 py-2`}
                >
                  <span className="truncate text-xs text-zinc-200">
                    {p.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-zinc-500">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {error ? <p className="mt-2 text-[11px] text-red-400">{error}</p> : null}
      </section>

      <LibraryImportProtagonistModal
        templateId={templateId}
        open={importOpen}
        busy={importBusy}
        onClose={() => {
          if (importBusy) return;
          setImportOpen(false);
        }}
        onConfirm={(setup) => void runImport(setup)}
      />
    </>
  );
}

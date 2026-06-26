"use client";

import {
  filterPublicLibraryTemplates,
  type LibraryTemplateId,
} from "@/lib/story/libraryTemplates";
import { StoryCover } from "@/components/StoryCover";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { ui } from "@/lib/ui/classes";

export function LibraryGrid({
  importingId,
  onImport,
}: {
  importingId: LibraryTemplateId | null;
  onImport: (id: LibraryTemplateId) => void;
}) {
  const { locale: uiLocale, t } = useUiLocale();
  const templates = filterPublicLibraryTemplates(uiLocale);

  if (!templates.length) {
    return (
      <section className="mt-6 px-0.5 text-xs text-zinc-500">
        {t("library.title")} — {t("library.emptyFilter")}
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="mb-2 px-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
          {t("library.title")}
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
          {t("library.gridHint")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {templates.map((template) => {
          const importing = importingId === template.id;
          const localeLabel =
            template.locale === "de"
              ? t("library.filterDe")
              : t("library.filterEn");

          return (
            <button
              key={template.id}
              type="button"
              disabled={importing}
              onClick={() => onImport(template.id)}
              aria-label={`${t("library.import")}: ${template.title}`}
              className={`${ui.card} group flex flex-col overflow-hidden text-left active:scale-[0.99] disabled:opacity-60`}
            >
              <div className="relative">
                <StoryCover
                  title={template.title}
                  libraryTemplateId={template.id}
                  coverImageSrc={template.coverImageSrc}
                  aspectClass="aspect-[2/3] w-full"
                  className="rounded-none border-0"
                />
                <span className="absolute right-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-100 backdrop-blur-sm">
                  {localeLabel}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2">
                <span className="line-clamp-2 text-xs font-medium leading-tight text-zinc-100">
                  {template.title}
                </span>
                <span className="mt-auto truncate text-[10px] text-zinc-500">
                  {template.genre}
                </span>
                <span
                  className={`mt-1 inline-flex items-center justify-center rounded-md border px-2 py-1 text-[10px] font-medium transition ${
                    importing
                      ? "border-surface-border text-zinc-500"
                      : "border-accent/40 bg-accent/12 text-accent group-hover:bg-accent/20"
                  }`}
                >
                  {importing ? t("library.importing") : t("library.import")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

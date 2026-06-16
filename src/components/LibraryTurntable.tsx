"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  filterPublicLibraryTemplates,
  type LibraryTemplateId,
  type LibraryTemplateDefinition,
} from "@/lib/story/libraryTemplates";
import { StoryCover } from "@/components/StoryCover";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function LibraryBookPanel({
  template,
  importing,
  onImport,
  localeLabel,
}: {
  template: LibraryTemplateDefinition;
  importing: boolean;
  onImport: () => void;
  localeLabel: string;
}) {
  const { t } = useUiLocale();

  return (
    <div className="flex overflow-hidden rounded-lg border border-surface-border bg-surface-raised/95 shadow-xl shadow-black/50 backdrop-blur-sm">
      <StoryCover
        title={template.title}
        libraryTemplateId={template.id}
        coverImageSrc={template.coverImageSrc}
        aspectClass="aspect-[2/3] w-[7.5rem] shrink-0 sm:w-32"
        className="rounded-none border-0"
      />
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-zinc-100">
            {template.title}
          </h3>
          <span className="shrink-0 rounded border border-zinc-700/80 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-400">
            {localeLabel}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-snug text-zinc-500">
          {template.tagline}
        </p>
        <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-zinc-400 sm:line-clamp-4">
          {template.defaultConcept}
        </p>
        <button
          type="button"
          disabled={importing}
          onClick={onImport}
          className="mt-2 w-full touch-manipulation rounded-md border border-accent/40 bg-accent/15 py-2 text-xs font-medium text-accent disabled:opacity-50"
        >
          {importing ? t("library.importing") : t("library.import")}
        </button>
      </div>
    </div>
  );
}

function TurntableSpine({
  template,
  active,
  onSelect,
}: {
  template: LibraryTemplateDefinition;
  active: boolean;
  onSelect: () => void;
}) {
  const spineLabel = template.spineTitle ?? template.title;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      aria-label={`${template.title}${active ? " — selected" : ""}`}
      className={`library-book-spine relative flex h-[9.5rem] w-[2.875rem] touch-manipulation flex-col items-center justify-center overflow-hidden rounded-sm border border-black/40 px-0.5 py-3 shadow-md sm:h-[10.5rem] sm:w-[3.125rem] ${
        active
          ? "z-10 scale-110 ring-2 ring-accent/70 brightness-110"
          : "opacity-85 brightness-90"
      }`}
      style={{ background: template.coverGradient }}
    >
      <span className="library-spine-texture pointer-events-none absolute inset-0" aria-hidden />
      <span className="library-spine-edge library-spine-edge--left" aria-hidden />
      <span className="library-spine-edge library-spine-edge--right" aria-hidden />
      <span className="library-spine-rule library-spine-rule--top" aria-hidden />
      <span className="library-spine-rule library-spine-rule--bottom" aria-hidden />
      <span
        className="library-spine-title relative z-[1] max-h-full px-0.5 text-[11px] font-semibold leading-tight tracking-wide text-amber-50/95 sm:text-[12px]"
        style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
        }}
      >
        {spineLabel}
      </span>
    </button>
  );
}

const SWIPE_THRESHOLD_PX = 42;

export function LibraryTurntable({
  importingId,
  onImport,
}: {
  importingId: LibraryTemplateId | null;
  onImport: (id: LibraryTemplateId) => void;
}) {
  const { locale: uiLocale, t } = useUiLocale();
  const templates = filterPublicLibraryTemplates(uiLocale);
  const count = templates.length;
  const angleStep = count > 0 ? 360 / count : 360;

  const [activeIndex, setActiveIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [uiLocale]);

  const activeTemplate = templates[activeIndex] ?? templates[0];
  const rotation = -activeIndex * angleStep;

  const goNext = useCallback(() => {
    if (count < 2) return;
    setActiveIndex((i) => mod(i + 1, count));
  }, [count]);

  const goPrev = useCallback(() => {
    if (count < 2) return;
    setActiveIndex((i) => mod(i - 1, count));
  }, [count]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    didDragRef.current = false;
    setDragging(false);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current) return;
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    if (dx > 8) {
      didDragRef.current = true;
      setDragging(true);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    pointerStart.current = null;
    if (
      didDragRef.current &&
      Math.abs(dx) > Math.abs(dy) &&
      Math.abs(dx) >= SWIPE_THRESHOLD_PX
    ) {
      if (dx < 0) goNext();
      else goPrev();
    }
    didDragRef.current = false;
    setDragging(false);
  };

  const onPointerCancel = () => {
    pointerStart.current = null;
    didDragRef.current = false;
    setDragging(false);
  };

  if (!activeTemplate) {
    return (
      <section className="mt-6 px-1 text-xs text-zinc-500">
        {t("library.title")} — {t("library.emptyFilter")}
      </section>
    );
  }

  const localeLabel =
    activeTemplate.locale === "de"
      ? t("library.filterDe")
      : t("library.filterEn");

  return (
    <section className="mt-6 flex flex-col gap-3">
      <div className="px-1">
        <h2 className="text-sm font-medium text-zinc-200">
          {t("library.title")}
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">{t("library.hint")}</p>
      </div>

      <div className="library-turntable mx-auto w-full max-w-md px-2">
        <div className="relative flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            disabled={count < 2}
            aria-label={t("library.prevBook")}
            className="library-turntable-nav z-20 shrink-0 touch-manipulation rounded-full border border-zinc-700/80 bg-surface-raised/90 p-2 text-zinc-300 hover:border-accent/40 hover:text-accent disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div
            className="library-turntable-viewport relative h-[13.5rem] w-full max-w-[17.5rem] flex-1 touch-pan-y sm:h-[14.5rem] sm:max-w-[19rem]"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            role="region"
            aria-roledescription="carousel"
            aria-label={`${t("library.carousel")}, ${activeIndex + 1} / ${count}`}
          >
            <div
              className="library-turntable-disc pointer-events-none absolute bottom-2 left-1/2 z-0 h-8 w-[88%] rounded-[50%] sm:bottom-3 sm:h-9"
              aria-hidden
              style={{
                transform: `translateX(-50%) rotateY(${rotation * 0.35}deg)`,
              }}
            />

            <div
              className="library-turntable-ring absolute inset-0"
              style={{
                transform: `translateZ(calc(-1 * var(--library-radius))) rotateY(${rotation}deg)`,
                transition: dragging
                  ? "none"
                  : "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {templates.map((template, i) => (
                <div
                  key={template.id}
                  className="library-turntable-cell absolute bottom-6 left-1/2 sm:bottom-7"
                  style={{
                    transform: `translateX(-50%) rotateY(${i * angleStep}deg) translateZ(var(--library-radius))`,
                  }}
                >
                  <TurntableSpine
                    template={template}
                    active={i === activeIndex}
                    onSelect={() => setActiveIndex(i)}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={count < 2}
            aria-label={t("library.nextBook")}
            className="library-turntable-nav z-20 shrink-0 touch-manipulation rounded-full border border-zinc-700/80 bg-surface-raised/90 p-2 text-zinc-300 hover:border-accent/40 hover:text-accent disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M9 18l6-6-6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <p className="mt-1 text-center text-[11px] tabular-nums text-zinc-500">
          {activeIndex + 1} / {count} · {activeTemplate.genre} · {localeLabel}
        </p>

        <div className="mt-3 px-1">
          <LibraryBookPanel
            template={activeTemplate}
            importing={importingId === activeTemplate.id}
            onImport={() => onImport(activeTemplate.id)}
            localeLabel={localeLabel}
          />
        </div>
      </div>
    </section>
  );
}

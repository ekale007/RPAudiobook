"use client";

import { useEffect, type ReactNode } from "react";

export function OverlayPanel({
  open,
  onClose,
  title,
  children,
  wide,
  blocking = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** When true, backdrop click and Escape do not close. */
  blocking?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!blocking && e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, blocking]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      {blocking ? (
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          aria-hidden
        />
      ) : (
        <button
          type="button"
          aria-label="Schließen"
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="overlay-title"
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-surface-border bg-surface shadow-2xl shadow-black/60 sm:max-h-[88dvh] sm:rounded-2xl ${
          wide ? "sm:max-w-lg" : "sm:max-w-md"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
          <h2 id="overlay-title" className="text-sm font-medium text-zinc-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-surface-raised hover:text-zinc-300"
            aria-label="Schließen"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {children}
        </div>
      </div>
    </div>
  );
}

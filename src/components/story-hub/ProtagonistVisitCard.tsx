"use client";

import { CharacterAvatar } from "@/components/CharacterAvatar";

export function ProtagonistVisitCard({
  displayName,
  voiceLabel,
  needsSetup,
  locale,
  onClick,
}: {
  displayName: string;
  voiceLabel?: string | null;
  needsSetup: boolean;
  locale: "de" | "en";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex aspect-[5/3] min-h-[108px] w-full flex-col overflow-hidden rounded-xl border border-sky-500/25 bg-gradient-to-br from-sky-950/40 via-surface-raised to-surface-raised text-left transition hover:-translate-y-0.5 hover:border-sky-400/40 hover:shadow-lg hover:shadow-black/30"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_55%)]" />

      <div className="relative flex flex-1 flex-col p-2.5">
        <div className="flex items-start gap-2">
          <CharacterAvatar
            name={displayName}
            className="h-9 w-9 ring-2 ring-sky-500/30"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-zinc-50">
              {displayName}
            </p>
            <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-sky-400/90">
              {locale === "de" ? "Du · Protagonist" : "You · Protagonist"}
            </p>
          </div>
        </div>

        <p className="mt-2 flex-1 text-[10px] leading-snug text-zinc-400 group-hover:text-zinc-300">
          {needsSetup
            ? locale === "de"
              ? "Tippe zum Einrichten — Name & Stimme"
              : "Tap to set up — name & voice"
            : locale === "de"
              ? "Deine gesprochenen Dialogzeilen"
              : "Your spoken dialogue lines"}
        </p>

        {voiceLabel ? (
          <p className="mt-1 truncate text-[9px] text-zinc-600">
            ♪ {voiceLabel}
          </p>
        ) : null}
      </div>
    </button>
  );
}

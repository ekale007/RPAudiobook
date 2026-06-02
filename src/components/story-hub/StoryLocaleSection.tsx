"use client";

import { useState } from "react";
import { updateStoryLocale } from "@/lib/db/stories";
import type { StoryContentLocale } from "@/lib/story/protagonist";

export function StoryLocaleSection({
  storyId,
  locale,
  onUpdated,
}: {
  storyId: string;
  locale: StoryContentLocale;
  onUpdated?: () => void;
}) {
  const [value, setValue] = useState<StoryContentLocale>(locale);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (value === locale) return;
    setBusy(true);
    setSaved(false);
    try {
      await updateStoryLocale(storyId, value);
      setSaved(true);
      onUpdated?.();
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-surface-border bg-surface-raised p-3">
      <h2 className="mb-1 text-xs font-medium text-zinc-300">
        {locale === "de" ? "Story-Sprache" : "Story language"}
      </h2>
      <p className="mb-2 text-[10px] leading-snug text-zinc-500">
        {locale === "de"
          ? "Steuert Erzähler-Prompt, Dialog-Erkennung (Anführungszeichen) und TTS-Routing."
          : "Controls narrator prompts, dialogue detection (quotes), and TTS routing."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={value}
          onChange={(e) =>
            setValue(e.target.value === "en" ? "en" : "de")
          }
          className="rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs"
        >
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
        <button
          type="button"
          disabled={busy || value === locale}
          onClick={() => void save()}
          className="rounded-lg border border-accent/40 px-2.5 py-1.5 text-xs text-accent disabled:opacity-40"
        >
          {busy ? "…" : saved ? "Gespeichert" : "Speichern"}
        </button>
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { KOKORO_VOICES } from "@/lib/tts/kokoroVoices";

export type VoiceFilterSelectProps = {
  value: string;
  onChange: (voiceId: string) => void;
  /** Story locale — used to preselect a language filter (de/en). */
  storyLocale?: "de" | "en" | string | null;
  disabled?: boolean;
  className?: string;
};

/**
 * Language/gender-filtered voice picker for the local Kokoro engine.
 * The full catalog spans 9 languages; a flat dropdown is unusable, so
 * this filters by language (defaulting to the story locale) and gender.
 */
export function KokoroFilteredVoiceSelect({
  value,
  onChange,
  storyLocale,
  disabled = false,
  className,
}: VoiceFilterSelectProps) {
  const languages = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of KOKORO_VOICES) {
      if (!map.has(v.language)) {
        const label =
          v.language === "de-de"
            ? "Deutsch"
            : v.language === "en-us"
              ? "English (US)"
              : v.language === "en-gb"
                ? "English (UK)"
                : v.language.toUpperCase();
        map.set(v.language, label);
      }
    }
    return [...map.entries()];
  }, []);

  // Default language filter: match story locale, else "all".
  const defaultLang =
    storyLocale === "de"
      ? "de-de"
      : storyLocale === "en"
        ? "en-us"
        : "all";

  const [langFilter, setLangFilter] = useState<string>(defaultLang);
  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male">(
    "all",
  );

  const filtered = useMemo(() => {
    return KOKORO_VOICES.filter((v) => {
      if (langFilter !== "all" && v.language !== langFilter) return false;
      if (genderFilter !== "all" && v.gender !== genderFilter) return false;
      return true;
    });
  }, [langFilter, genderFilter]);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface px-1.5 py-1 text-[10px]"
          aria-label="Sprache der Stimme"
        >
          <option value="all">Alle Sprachen</option>
          {languages.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={genderFilter}
          onChange={(e) =>
            setGenderFilter(e.target.value as "all" | "female" | "male")
          }
          disabled={disabled}
          className="rounded-lg border border-surface-border bg-surface px-1.5 py-1 text-[10px]"
          aria-label="Geschlecht der Stimme"
        >
          <option value="all">Alle</option>
          <option value="female">Weiblich</option>
          <option value="male">Männlich</option>
        </select>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={
          className ??
          "w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs disabled:opacity-50"
        }
      >
        {!filtered.some((v) => v.id === value) ? (
          <option value={value}>{value} (aktuell)</option>
        ) : null}
        {filtered.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label} — {v.hint}
          </option>
        ))}
      </select>
    </div>
  );
}
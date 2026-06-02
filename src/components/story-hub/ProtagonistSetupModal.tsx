"use client";

import { useState } from "react";
import { OverlayPanel } from "@/components/ui/OverlayPanel";
import { updateStorySettings } from "@/lib/db/stories";
import { loadTtsSettings } from "@/lib/storage/ttsSettings";
import { mergeVoiceMapForProvider } from "@/lib/tts/defaultVoiceMap";
import {
  defaultProtagonistProfile,
  normalizeStoryContentLocale,
  type StoryContentLocale,
  withProtagonistVoice,
} from "@/lib/story/protagonist";
import type { StoryProtagonistProfile, StorySettings } from "@/lib/types";

export function ProtagonistSetupModal({
  open,
  storyId,
  storyLocale,
  storySettings,
  onComplete,
}: {
  open: boolean;
  storyId: string;
  storyLocale: string | null | undefined;
  storySettings: StorySettings;
  onComplete: (settings: StorySettings) => void;
}) {
  const locale = normalizeStoryContentLocale(storyLocale);
  const defaults = defaultProtagonistProfile(locale);

  const [name, setName] = useState(defaults.displayName);
  const [pronouns, setPronouns] =
    useState<StoryProtagonistProfile["pronouns"]>(defaults.pronouns);
  const [gender, setGender] = useState<
    StoryProtagonistProfile["gender"]
  >(defaults.gender ?? "neutral");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pronounOptions: Array<{
    id: StoryProtagonistProfile["pronouns"];
    label: string;
  }> =
    locale === "de"
      ? [
          { id: "du", label: "Du (neutral)" },
          { id: "sie", label: "Sie (weiblich)" },
          { id: "er", label: "Er (männlich)" },
        ]
      : [
          { id: "you", label: "You" },
          { id: "they", label: "They" },
        ];

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const profile: StoryProtagonistProfile = {
        displayName: name.trim() || defaults.displayName,
        pronouns,
        gender,
      };
      const tts = loadTtsSettings();
      const voiceMap = withProtagonistVoice(
        mergeVoiceMapForProvider(
          tts.provider,
          locale,
          storySettings.voiceMap,
        ),
      );
      const merged = await updateStorySettings(storyId, {
        protagonist: profile,
        voiceMap,
      });
      onComplete(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OverlayPanel
      open={open}
      onClose={() => undefined}
      blocking
      title={locale === "de" ? "Dein Charakter" : "Your character"}
      wide
    >
      <p className="mb-4 text-sm text-zinc-400">
        {locale === "de"
          ? "Name und Anrede für deine Dialogzeilen. Die Erzähler-Stimme bleibt getrennt — du kannst sie unter Cast anpassen."
          : "Name and address for your spoken lines. Narrator voice stays separate — adjust it under Cast."}
      </p>

      <label className="mb-3 block text-xs text-zinc-400">
        {locale === "de" ? "Name im Spiel" : "In-story name"}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
          placeholder={locale === "de" ? "z. B. Alex" : "e.g. Alex"}
        />
      </label>

      <fieldset className="mb-3">
        <legend className="mb-1 text-xs text-zinc-400">
          {locale === "de" ? "Anrede / Pronomen" : "Pronouns"}
        </legend>
        <div className="flex flex-col gap-1.5">
          {pronounOptions.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="pronouns"
                checked={pronouns === o.id}
                onChange={() => setPronouns(o.id)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mb-4 block text-xs text-zinc-400">
        {locale === "de" ? "Geschlecht (für Beschreibungen)" : "Gender (for descriptions)"}
        <select
          value={gender ?? "neutral"}
          onChange={(e) =>
            setGender(e.target.value as StoryProtagonistProfile["gender"])
          }
          className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
        >
          <option value="neutral">
            {locale === "de" ? "Neutral / offen" : "Neutral"}
          </option>
          <option value="female">{locale === "de" ? "Weiblich" : "Female"}</option>
          <option value="male">{locale === "de" ? "Männlich" : "Male"}</option>
        </select>
      </label>

      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        {busy
          ? locale === "de"
            ? "Speichern…"
            : "Saving…"
          : locale === "de"
            ? "Story starten"
            : "Start story"}
      </button>
    </OverlayPanel>
  );
}

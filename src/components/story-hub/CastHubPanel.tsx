"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CastCharacterOverlay } from "@/components/story-hub/CastCharacterOverlay";
import { CastDiscoverOverlay } from "@/components/story-hub/CastDiscoverOverlay";
import { CastVisitCard } from "@/components/story-hub/CastVisitCard";
import { type CharacterRow } from "@/lib/db/stories";
import {
  DEFAULT_QWEN_VOICE_MAP,
  DEFAULT_WRYTOUR_VOICE_MAP,
  mergeVoiceMapForProvider,
} from "@/lib/tts/defaultVoiceMap";
import { ELEVEN_DEFAULT_NARRATOR } from "@/lib/tts/elevenLabsVoices";
import { KOKORO_VOICES } from "@/lib/tts/kokoroVoices";
import { QWEN_DEFAULT_NARRATOR, QWEN_VOICES } from "@/lib/tts/qwenVoices";
import { defaultEnabledCastSlugs } from "@/lib/tts/voiceActivation";
import { loadTtsSettings, type TtsProvider } from "@/lib/storage/ttsSettings";
import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import type { StorySettings, VoiceMap } from "@/lib/types";

function voiceOptionsForEngine(engine: LocalTtsEngine) {
  if (engine === "qwen") {
    return QWEN_VOICES.map((v) => ({
      id: v.id,
      label: `${v.label} (${v.hint})`,
    }));
  }
  return KOKORO_VOICES.map((v) => ({
    id: v.id,
    label: `${v.label} (${v.id})`,
  }));
}

function defaultMapForEngine(engine: LocalTtsEngine): VoiceMap {
  return engine === "qwen" ? DEFAULT_QWEN_VOICE_MAP : DEFAULT_WRYTOUR_VOICE_MAP;
}

function fallbackVoice(provider: TtsProvider, engine: LocalTtsEngine): string {
  if (provider === "elevenlabs") return ELEVEN_DEFAULT_NARRATOR;
  return engine === "qwen" ? QWEN_DEFAULT_NARRATOR : "af_bella";
}

function shortVoiceLabel(
  slug: string,
  voiceMap: VoiceMap,
  defaults: VoiceMap,
  fallback: string,
  ttsProvider: TtsProvider,
  localEngine: LocalTtsEngine,
): string | null {
  const id = voiceMap[slug] ?? defaults[slug] ?? fallback;
  if (ttsProvider === "elevenlabs") {
    return id.length > 10 ? `${id.slice(0, 8)}…` : id;
  }
  const options = voiceOptionsForEngine(localEngine);
  return options.find((v) => v.id === id)?.label.split(" (")[0] ?? id;
}

export function CastHubPanel({
  storyId,
  storyTitle,
  storyConcept,
  cast,
  userId,
  storyLocale,
  storySettings,
  onSaved,
}: {
  storyId: string;
  storyTitle: string;
  storyConcept: string | null;
  userId: string | null;
  cast: CharacterRow[];
  storyLocale: "de" | "en";
  storySettings: StorySettings;
  onSaved?: () => void;
}) {
  const characters = useMemo(
    () => cast.filter((c) => c.role === "narrator" || c.role === "cast"),
    [cast],
  );

  const tts = loadTtsSettings();
  const [ttsProvider] = useState<TtsProvider>(tts.provider);
  const [localEngine] = useState<LocalTtsEngine>(
    tts.localEngine === "qwen" || tts.localEngine === "kokoro"
      ? tts.localEngine
      : "kokoro",
  );

  const [voiceMap, setVoiceMap] = useState<VoiceMap>(() =>
    mergeVoiceMapForProvider(tts.provider, storyLocale, storySettings.voiceMap),
  );
  const [voiceEnabledSlugs, setVoiceEnabledSlugs] = useState<string[]>(
    storySettings.voiceEnabledSlugs ?? defaultEnabledCastSlugs(cast),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discoverOpen, setDiscoverOpen] = useState(false);

  useEffect(() => {
    setVoiceMap(
      mergeVoiceMapForProvider(ttsProvider, storyLocale, storySettings.voiceMap),
    );
    setVoiceEnabledSlugs(
      storySettings.voiceEnabledSlugs ?? defaultEnabledCastSlugs(cast),
    );
  }, [storySettings, storyLocale, ttsProvider, cast]);

  const engine =
    localEngine === "qwen" || localEngine === "kokoro" ? localEngine : "kokoro";
  const voiceOptions = voiceOptionsForEngine(engine);
  const defaults =
    ttsProvider === "elevenlabs"
      ? mergeVoiceMapForProvider("elevenlabs", storyLocale, null)
      : defaultMapForEngine(engine);
  const fallback = fallbackVoice(ttsProvider, engine);

  const selected = characters.find((c) => c.id === selectedId) ?? null;

  const openCharacter = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleImported = (characterId: string) => {
    onSaved?.();
    setDiscoverOpen(false);
    setSelectedId(characterId);
  };

  if (!characters.length) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[11px] text-zinc-500">Noch kein Cast.</p>
        <button
          type="button"
          onClick={() => setDiscoverOpen(true)}
          className="rounded-xl border border-accent/30 py-2 text-xs text-accent"
        >
          Aus Story holen
        </button>
        <CastDiscoverOverlay
          open={discoverOpen}
          onClose={() => setDiscoverOpen(false)}
          storyId={storyId}
          cast={cast}
          storyTitle={storyTitle}
          storyConcept={storyConcept}
          storyLocale={storyLocale}
          storySettings={storySettings}
          onImported={handleImported}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-snug text-zinc-600">
          Tippe eine Karte —{" "}
          <Link href="/settings" className="text-accent underline">
            TTS
          </Link>
        </p>
        <button
          type="button"
          onClick={() => setDiscoverOpen(true)}
          className="shrink-0 rounded-lg border border-accent/30 px-2 py-1 text-[10px] font-medium text-accent"
        >
          + Aus Story
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {characters.map((c) => {
          const isNarrator = c.role === "narrator";
          const archived = c.status === "archived";
          const voiceDisabled =
            !isNarrator && !voiceEnabledSlugs.includes(c.slug);
          const voiceLabel = voiceDisabled
            ? "Erzähler"
            : shortVoiceLabel(
                c.slug,
                voiceMap,
                defaults,
                fallback,
                ttsProvider,
                engine,
              );

          return (
            <CastVisitCard
              key={c.id}
              character={c}
              archived={archived}
              isNarrator={isNarrator}
              voiceLabel={voiceLabel}
              onClick={() => openCharacter(c.id)}
            />
          );
        })}
      </div>

      <CastCharacterOverlay
        open={selectedId !== null}
        character={selected}
        storyId={storyId}
        userId={userId}
        storyLocale={storyLocale}
        storyTitle={storyTitle}
        storyConcept={storyConcept}
        storySettings={storySettings}
        ttsProvider={ttsProvider}
        localEngine={engine}
        voiceOptions={voiceOptions}
        defaults={defaults}
        fallback={fallback}
        voiceMap={voiceMap}
        voiceEnabledSlugs={voiceEnabledSlugs}
        onVoiceMapChange={setVoiceMap}
        onVoiceEnabledChange={setVoiceEnabledSlugs}
        onClose={() => setSelectedId(null)}
        onSaved={onSaved}
      />

      <CastDiscoverOverlay
        open={discoverOpen}
        onClose={() => setDiscoverOpen(false)}
        storyId={storyId}
        cast={cast}
        storyTitle={storyTitle}
        storyConcept={storyConcept}
        storyLocale={storyLocale}
        storySettings={storySettings}
        onImported={handleImported}
      />
    </div>
  );
}

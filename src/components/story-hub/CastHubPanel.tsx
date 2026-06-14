"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CastCharacterOverlay } from "@/components/story-hub/CastCharacterOverlay";
import { CastDiscoverOverlay } from "@/components/story-hub/CastDiscoverOverlay";
import { CastVisitCard } from "@/components/story-hub/CastVisitCard";
import { ProtagonistCastOverlay } from "@/components/story-hub/ProtagonistCastOverlay";
import { ProtagonistVisitCard } from "@/components/story-hub/ProtagonistVisitCard";
import { type CharacterRow } from "@/lib/db/stories";
import {
  DEFAULT_QWEN_VOICE_MAP,
  DEFAULT_WRYTOUR_VOICE_MAP,
  mergeVoiceMapForProvider,
  patchStoryVoiceMaps,
  resolveStoryVoiceMap,
  voiceMapStorageKey,
} from "@/lib/tts/defaultVoiceMap";
import { ELEVEN_DEFAULT_NARRATOR } from "@/lib/tts/elevenLabsVoices";
import { KOKORO_VOICES } from "@/lib/tts/kokoroVoices";
import { QWEN_DEFAULT_NARRATOR, QWEN_VOICES } from "@/lib/tts/qwenVoices";
import { defaultEnabledCastSlugs } from "@/lib/tts/voiceActivation";
import { loadTtsSettings, type TtsProvider } from "@/lib/storage/ttsSettings";
import { PREFS_UPDATED_EVENT } from "@/lib/storage/userPreferencesSync";
import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import type { QwenVoiceProfile, StorySettings, VoiceMap } from "@/lib/types";
import {
  buildQwenProfilesFromSettings,
} from "@/lib/tts/qwenVoiceProfiles";
import { isQwenTtsMode } from "@/lib/tts/qwenTtsMode";
import { supportsSceneDelivery } from "@/lib/tts/sceneDelivery";
import { updateStorySettings } from "@/lib/db/stories";
import {
  needsProtagonistSetup,
  PROTAGONIST_SPEAKER_SLUG,
  protagonistDisplayLabel,
} from "@/lib/story/protagonist";
import { repairStoryElevenVoiceMap } from "@/lib/tts/elevenLabsCatalogClient";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

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
  if (provider === "qwen" || provider === "qwen-cloud") return QWEN_DEFAULT_NARRATOR;
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
  const engineForOptions =
    ttsProvider === "qwen" || ttsProvider === "qwen-cloud"
      ? "qwen"
      : localEngine;
  const options = voiceOptionsForEngine(engineForOptions);
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
  const { t } = useUiLocale();
  const characters = useMemo(
    () => cast.filter((c) => c.role === "narrator" || c.role === "cast"),
    [cast],
  );

  const castSlugsForVoices = useMemo(
    () => [PROTAGONIST_SPEAKER_SLUG, ...cast.map((c) => c.slug)],
    [cast],
  );

  const tts = loadTtsSettings();
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>(tts.provider);
  const [localEngine, setLocalEngine] = useState<LocalTtsEngine>(
    tts.provider === "qwen" || tts.provider === "qwen-cloud"
      ? "qwen"
      : tts.localEngine === "qwen" || tts.localEngine === "kokoro"
        ? tts.localEngine
        : "kokoro",
  );

  const [voiceMap, setVoiceMap] = useState<VoiceMap>(() => {
    const tts = loadTtsSettings();
    return resolveStoryVoiceMap(storySettings, tts.provider, storyLocale, {
      localEngine: tts.localEngine,
      falTtsModel: tts.falTtsModel,
    });
  });
  const [voiceEnabledSlugs, setVoiceEnabledSlugs] = useState<string[]>(
    storySettings.voiceEnabledSlugs ?? defaultEnabledCastSlugs(cast),
  );
  const [qwenProfiles, setQwenProfiles] = useState<
    Record<string, QwenVoiceProfile>
  >(() =>
    buildQwenProfilesFromSettings(storySettings, castSlugsForVoices),
  );
  const [qwenSceneInstruct, setQwenSceneInstruct] = useState(
    storySettings.qwenSceneInstructEnabled !== false,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [protagonistOpen, setProtagonistOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [voiceRepairNote, setVoiceRepairNote] = useState<string | null>(null);
  const voiceEditsDirtyRef = useRef(false);
  const voiceRepairRanRef = useRef(false);

  const engine: LocalTtsEngine =
    ttsProvider === "qwen" || ttsProvider === "qwen-cloud"
      ? "qwen"
      : localEngine === "qwen" || localEngine === "kokoro"
        ? localEngine
        : "kokoro";
  const qwen = isQwenTtsMode(ttsProvider, engine);
  const sceneDelivery = supportsSceneDelivery(ttsProvider);

  const voiceMapOpts = useMemo(
    () => ({
      localEngine: engine,
      falTtsModel: loadTtsSettings().falTtsModel,
    }),
    [engine],
  );

  const serverVoiceMapKey = useMemo(
    () =>
      JSON.stringify(
        storySettings.voiceMaps?.[
          voiceMapStorageKey(ttsProvider, localEngine)
        ] ??
          storySettings.voiceMap ??
          {},
      ),
    [
      storySettings.voiceMaps,
      storySettings.voiceMap,
      ttsProvider,
      localEngine,
    ],
  );
  const serverVoiceEnabledKey = useMemo(
    () => JSON.stringify(storySettings.voiceEnabledSlugs ?? []),
    [storySettings.voiceEnabledSlugs],
  );
  const serverQwenProfilesKey = useMemo(
    () => JSON.stringify(storySettings.qwenVoiceProfiles ?? {}),
    [storySettings.qwenVoiceProfiles],
  );

  useEffect(() => {
    const next = loadTtsSettings();
    setTtsProvider(next.provider);
    if (next.provider === "qwen" || next.provider === "qwen-cloud") {
      setLocalEngine("qwen");
    } else if (next.localEngine === "qwen" || next.localEngine === "kokoro") {
      setLocalEngine(next.localEngine);
    }
  }, []);

  useEffect(() => {
    const onPrefs = () => {
      const next = loadTtsSettings();
      setTtsProvider(next.provider);
    };
    window.addEventListener(PREFS_UPDATED_EVENT, onPrefs);
    return () => window.removeEventListener(PREFS_UPDATED_EVENT, onPrefs);
  }, []);

  useEffect(() => {
    if (ttsProvider !== "elevenlabs" || voiceRepairRanRef.current) return;
    if (voiceEditsDirtyRef.current) return;
    voiceRepairRanRef.current = true;

    const base = resolveStoryVoiceMap(
      storySettings,
      ttsProvider,
      storyLocale,
      voiceMapOpts,
    );
    void repairStoryElevenVoiceMap(base, storyLocale).then(({ map, changed }) => {
      if (!changed.length) return;
      voiceEditsDirtyRef.current = true;
      setVoiceMap(map);
      const label = (slug: string) =>
        slug === "protagonist"
          ? t("cast.protagonist")
          : slug === "narrator"
            ? t("cast.narrator")
            : slug;
      void updateStorySettings(storyId, {
        ...patchStoryVoiceMaps(
          storySettings,
          ttsProvider,
          storyLocale,
          map,
          voiceMapOpts,
        ),
        voiceEnabledSlugs,
      }).then(() => {
        voiceEditsDirtyRef.current = false;
        onSaved?.();
        setVoiceRepairNote(
          t("cast.voiceRepair", { names: changed.map(label).join(", ") }),
        );
      });
    });
  }, [
    ttsProvider,
    storyId,
    storyLocale,
    storySettings,
    voiceMapOpts,
    voiceEnabledSlugs,
    onSaved,
    t,
  ]);

  useEffect(() => {
    if (voiceEditsDirtyRef.current) return;
    setVoiceMap(
      resolveStoryVoiceMap(
        storySettings,
        ttsProvider,
        storyLocale,
        voiceMapOpts,
      ),
    );
    setVoiceEnabledSlugs(
      storySettings.voiceEnabledSlugs ?? defaultEnabledCastSlugs(cast),
    );
    setQwenProfiles(
      buildQwenProfilesFromSettings(storySettings, castSlugsForVoices),
    );
    setQwenSceneInstruct(storySettings.qwenSceneInstructEnabled !== false);
  }, [
    serverVoiceMapKey,
    serverVoiceEnabledKey,
    serverQwenProfilesKey,
    storyLocale,
    ttsProvider,
    voiceMapOpts,
    castSlugsForVoices,
  ]);

  const setVoiceMapTracked = useCallback((map: VoiceMap) => {
    voiceEditsDirtyRef.current = true;
    setVoiceMap(map);
  }, []);

  const handleCastSaved = useCallback(() => {
    voiceEditsDirtyRef.current = false;
    onSaved?.();
  }, [onSaved]);

  const voiceOptions = voiceOptionsForEngine(engine);
  const defaults =
    ttsProvider === "elevenlabs"
      ? mergeVoiceMapForProvider("elevenlabs", storyLocale, null)
      : ttsProvider === "qwen"
        ? mergeVoiceMapForProvider("qwen", storyLocale, null)
        : defaultMapForEngine(engine);
  const fallback = fallbackVoice(ttsProvider, engine);

  const selected = characters.find((c) => c.id === selectedId) ?? null;
  const narratorCharacter = characters.find((c) => c.role === "narrator");
  const castCharacters = characters.filter((c) => c.role === "cast");

  const protagonistLabel = protagonistDisplayLabel(storySettings, storyLocale);
  const protagonistNeedsSetup = needsProtagonistSetup(storySettings);
  const protagonistVoiceLabel = shortVoiceLabel(
    PROTAGONIST_SPEAKER_SLUG,
    voiceMap,
    defaults,
    fallback,
    ttsProvider,
    engine,
  );

  const openCharacter = useCallback((id: string) => {
    setProtagonistOpen(false);
    setSelectedId(id);
  }, []);

  const openProtagonist = useCallback(() => {
    setSelectedId(null);
    setProtagonistOpen(true);
  }, []);

  const handleImported = (characterId: string) => {
    onSaved?.();
    setDiscoverOpen(false);
    setSelectedId(characterId);
  };

  const renderCastCard = (c: (typeof characters)[number]) => {
    const isNarrator = c.role === "narrator";
    const archived = c.status === "archived";
    const voiceDisabled =
      !isNarrator && !voiceEnabledSlugs.includes(c.slug);
    const voiceLabel = voiceDisabled
      ? t("cast.narrator")
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
  };

  const protagonistOverlay = (
    <ProtagonistCastOverlay
      open={protagonistOpen}
      onClose={() => setProtagonistOpen(false)}
      storyId={storyId}
      storyLocale={storyLocale}
      storySettings={storySettings}
      ttsProvider={ttsProvider}
      localEngine={engine}
      voiceOptions={voiceOptions}
      defaults={defaults}
      fallback={fallback}
      voiceMap={voiceMap}
      qwenMode={qwen}
      qwenProfile={qwenProfiles[PROTAGONIST_SPEAKER_SLUG]}
      onVoiceMapChange={setVoiceMapTracked}
      onQwenProfileChange={(slug, profile) => {
        voiceEditsDirtyRef.current = true;
        setQwenProfiles((prev) => ({ ...prev, [slug]: profile }));
        setVoiceMap((prev) => ({
          ...prev,
          [slug]: profile.presetSpeaker ?? prev[slug],
        }));
      }}
      qwenProfiles={qwenProfiles}
      qwenSceneInstruct={qwenSceneInstruct}
      voiceEnabledSlugs={voiceEnabledSlugs}
      onSaved={handleCastSaved}
    />
  );

  if (!characters.length) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
          <ProtagonistVisitCard
            displayName={protagonistLabel}
            needsSetup={protagonistNeedsSetup}
            locale={storyLocale}
            voiceLabel={protagonistVoiceLabel}
            onClick={openProtagonist}
          />
        </div>
        <p className="text-[11px] text-zinc-500">{t("cast.noNpcCast")}</p>
        <button
          type="button"
          onClick={() => setDiscoverOpen(true)}
          className="rounded-xl border border-accent/30 py-2 text-xs text-accent"
        >
          {t("cast.fromStory")}
        </button>
        {protagonistOverlay}
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
      {voiceRepairNote ? (
        <p className="rounded-lg border border-sky-500/30 bg-sky-950/40 px-2.5 py-2 text-[10px] leading-snug text-sky-200/90">
          {voiceRepairNote}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-snug text-zinc-600">
          {t("cast.cardHint")}{" "}
          <Link href="/settings" className="text-accent underline">
            TTS
          </Link>
          {" "}
          ·{" "}
          <Link
            href={`/story/${storyId}/voices`}
            className="text-accent underline"
          >
            {t("cast.allVoices")}
          </Link>
        </p>
        <button
          type="button"
          onClick={() => setDiscoverOpen(true)}
          className="shrink-0 rounded-lg border border-accent/30 px-2 py-1 text-[10px] font-medium text-accent"
        >
          {t("cast.addFromStory")}
        </button>
      </div>

      {sceneDelivery ? (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-surface-border/80 bg-surface px-2.5 py-2">
          <input
            type="checkbox"
            checked={qwenSceneInstruct}
            onChange={(e) => {
              const on = e.target.checked;
              setQwenSceneInstruct(on);
              void updateStorySettings(storyId, {
                qwenSceneInstructEnabled: on,
                ...patchStoryVoiceMaps(
                  storySettings,
                  ttsProvider,
                  storyLocale,
                  voiceMap,
                  voiceMapOpts,
                ),
                voiceEnabledSlugs,
                qwenVoiceProfiles: qwenProfiles,
              }).then(() => handleCastSaved());
            }}
            className="mt-0.5 size-3.5 rounded border-surface-border"
          />
          <span className="text-[10px] leading-snug text-zinc-500">
            <strong className="text-zinc-300">{t("cast.sceneStyle")}</strong>{" "}
            {t("cast.sceneStyleDesc")}
          </span>
        </label>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {narratorCharacter ? renderCastCard(narratorCharacter) : null}
        <ProtagonistVisitCard
          displayName={protagonistLabel}
          needsSetup={protagonistNeedsSetup}
          locale={storyLocale}
          voiceLabel={protagonistVoiceLabel}
          onClick={openProtagonist}
        />
        {castCharacters.map((c) => renderCastCard(c))}
      </div>

      {protagonistOverlay}

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
        qwenMode={qwen}
        qwenProfiles={qwenProfiles}
        qwenProfile={
          selected ? qwenProfiles[selected.slug] : undefined
        }
        onVoiceMapChange={setVoiceMapTracked}
        onVoiceEnabledChange={(slugs) => {
          voiceEditsDirtyRef.current = true;
          setVoiceEnabledSlugs(slugs);
        }}
        onQwenProfileChange={(slug, profile) => {
          voiceEditsDirtyRef.current = true;
          setQwenProfiles((prev) => ({ ...prev, [slug]: profile }));
          setVoiceMap((prev) => ({
            ...prev,
            [slug]: profile.presetSpeaker ?? prev[slug],
          }));
        }}
        qwenSceneInstruct={qwenSceneInstruct}
        onClose={() => setSelectedId(null)}
        onSaved={handleCastSaved}
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

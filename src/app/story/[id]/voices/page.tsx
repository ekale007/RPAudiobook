"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ElevenLabsVoiceSelect } from "@/components/ElevenLabsVoiceSelect";
import { FishAudioVoiceSelect } from "@/components/FishAudioVoiceSelect";
import { FalTtsVoiceSelect } from "@/components/FalTtsVoiceSelect";
import { OpenRouterTtsVoiceSelect } from "@/components/OpenRouterTtsVoiceSelect";
import { QwenVoiceEditor } from "@/components/QwenVoiceEditor";
import { createClient } from "@/lib/supabase/client";
import {
  listCharacters,
  parseStorySettings,
  updateStorySettings,
} from "@/lib/db/stories";
import {
  DEFAULT_QWEN_VOICE_MAP,
  DEFAULT_WRYTOUR_VOICE_MAP,
  mergeVoiceMapForProvider,
  patchStoryVoiceMaps,
  resolveStoryVoiceMap,
} from "@/lib/tts/defaultVoiceMap";
import { ELEVEN_DEFAULT_NARRATOR } from "@/lib/tts/elevenLabsVoices";
import { KOKORO_VOICES } from "@/lib/tts/kokoroVoices";
import {
  QWEN_DEFAULT_NARRATOR,
  QWEN_VOICES,
} from "@/lib/tts/qwenVoices";
import {
  buildQwenProfilesFromSettings,
  emptyQwenProfile,
} from "@/lib/tts/qwenVoiceProfiles";
import {
  loadTtsSettings,
  saveFishAudioPinnedIds,
  DEFAULT_TTS,
  type TtsProvider,
} from "@/lib/storage/ttsSettings";
import {
  DEFAULT_OPENROUTER_TTS_MODEL,
  normalizeOpenRouterTtsModel,
} from "@/lib/tts/openRouterTtsModels";
import { normalizeFalTtsModel } from "@/lib/tts/falTtsModels";
import { defaultEnabledCastSlugs } from "@/lib/tts/voiceActivation";
import {
  PROTAGONIST_SPEAKER_SLUG,
  protagonistDisplayLabel,
} from "@/lib/story/protagonist";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";
import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import type { QwenVoiceProfile, StorySettings, VoiceMap } from "@/lib/types";

type VoiceOption = { id: string; label: string };

function voiceOptionsForEngine(engine: LocalTtsEngine): VoiceOption[] {
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

function isQwenMode(provider: TtsProvider, engine: LocalTtsEngine): boolean {
  return (
    provider === "qwen" ||
    provider === "qwen-cloud" ||
    (provider === "local" && engine === "qwen")
  );
}

export default function StoryVoicesPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [cast, setCast] = useState<
    Awaited<ReturnType<typeof listCharacters>>
  >([]);
  const [storySettings, setStorySettings] = useState<StorySettings>({
    recentTurnCount: 24,
    loreTokenBudget: 3500,
  });
  const [voiceMap, setVoiceMap] = useState<VoiceMap>({});
  const [qwenProfiles, setQwenProfiles] = useState<
    Record<string, QwenVoiceProfile>
  >({});
  const [qwenSceneInstruct, setQwenSceneInstruct] = useState(true);
  const [voiceEnabledSlugs, setVoiceEnabledSlugs] = useState<string[]>([]);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>("elevenlabs");
  const [localEngine, setLocalEngine] = useState<LocalTtsEngine>("kokoro");
  const [storyLocale, setStoryLocale] = useState<"de" | "en">("de");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protagonistLabel, setProtagonistLabel] = useState("Protagonist (du)");
  const [orTtsModel, setOrTtsModel] = useState(DEFAULT_OPENROUTER_TTS_MODEL);
  const [fishModel, setFishModel] = useState("s2-pro");
  const [falTtsModel, setFalTtsModel] = useState(DEFAULT_TTS.falTtsModel);
  const [fishPinnedIds, setFishPinnedIds] = useState<string[]>([]);
  const [expandedSlug, setExpandedSlug] = useState<string | null>("narrator");

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: auth }) => {
        if (!auth.user) {
          router.replace("/login");
          return;
        }
        const tts = loadTtsSettings();
        setTtsProvider(tts.provider);
        setOrTtsModel(normalizeOpenRouterTtsModel(tts.openRouterTtsModel));
        setFishModel(tts.fishAudioModel || "s2-pro");
        setFalTtsModel(normalizeFalTtsModel(tts.falTtsModel));
        setFishPinnedIds(tts.fishAudioPinnedIds ?? []);
        setLocalEngine(tts.localEngine ?? "edge");

        Promise.all([
          listCharacters(storyId),
          createClient()
            .from("stories")
            .select("settings, locale")
            .eq("id", storyId)
            .single(),
        ])
          .then(([chars, storyRes]) => {
            if (storyRes.error) throw storyRes.error;
            const locale = normalizeStoryLocale(storyRes.data.locale as string);
            setStoryLocale(locale);
            const settings = parseStorySettings(storyRes.data.settings);
            setStorySettings(settings);
            const castRows = chars.filter(
              (c) => c.role === "cast" || c.role === "narrator",
            );
            setCast(castRows);
            const vmOpts = {
              localEngine:
                tts.localEngine === "qwen" || tts.localEngine === "kokoro"
                  ? tts.localEngine
                  : "kokoro",
              falTtsModel: tts.falTtsModel,
            };
            setVoiceMap(
              resolveStoryVoiceMap(settings, tts.provider, locale, vmOpts),
            );
            setQwenSceneInstruct(settings.qwenSceneInstructEnabled !== false);
            const slugs = castRows.map((c) => c.slug);
            setQwenProfiles(
              buildQwenProfilesFromSettings(settings, slugs),
            );
            setVoiceEnabledSlugs(
              settings.voiceEnabledSlugs ??
                defaultEnabledCastSlugs(castRows),
            );
            setProtagonistLabel(protagonistDisplayLabel(settings, locale));
          })
          .catch((e) => setError(String(e)));
      });
  }, [storyId, router]);

  const engine =
    localEngine === "qwen" || localEngine === "kokoro" ? localEngine : "kokoro";
  const voiceMapOpts = {
    localEngine: engine,
    falTtsModel,
  };
  const qwen = isQwenMode(ttsProvider, localEngine);
  const voiceOptions = voiceOptionsForEngine(engine);
  const defaults =
    ttsProvider === "elevenlabs"
      ? mergeVoiceMapForProvider("elevenlabs", storyLocale, null)
      : defaultMapForEngine(engine);
  const fallback = fallbackVoice(ttsProvider, engine);

  const speakers = useMemo(() => {
    const narrator = cast.find((c) => c.role === "narrator");
    const castSpeakers = cast
      .filter((c) => c.role === "cast" && (c.status ?? "active") === "active")
      .map((c) => ({ slug: c.slug, name: c.name }));
    return [
      {
        slug: "narrator",
        name: narrator?.name ?? (storyLocale === "de" ? "Erzähler" : "Narrator"),
        isNarrator: true,
        isProtagonist: false,
      },
      {
        slug: PROTAGONIST_SPEAKER_SLUG,
        name: protagonistLabel,
        isNarrator: false,
        isProtagonist: true,
      },
      ...castSpeakers.map((c) => ({
        ...c,
        isNarrator: false,
        isProtagonist: false,
      })),
    ];
  }, [cast, storyLocale, protagonistLabel]);

  const toggleVoiceActive = (slug: string, active: boolean) => {
    setVoiceEnabledSlugs((prev) => {
      const has = prev.includes(slug);
      if (active && !has) return [...prev, slug];
      if (!active && has) return prev.filter((s) => s !== slug);
      return prev;
    });
  };

  const updateQwenProfile = (slug: string, next: QwenVoiceProfile) => {
    setQwenProfiles((prev) => ({ ...prev, [slug]: next }));
    setVoiceMap((prev) => ({
      ...prev,
      [slug]: next.presetSpeaker ?? prev[slug],
    }));
  };

  const save = async () => {
    setError(null);
    try {
      const vmOpts = voiceMapOpts;
      const patch: Parameters<typeof updateStorySettings>[1] = {
        ...patchStoryVoiceMaps(
          storySettings,
          ttsProvider,
          storyLocale,
          voiceMap,
          vmOpts,
        ),
        voiceEnabledSlugs,
      };
      if (qwen) {
        patch.qwenVoiceProfiles = qwenProfiles;
        patch.qwenSceneInstructEnabled = qwenSceneInstruct;
      }
      const merged = await updateStorySettings(storyId, patch);
      setStorySettings(merged);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    }
  };

  const engineLabel = qwen
    ? "Qwen3-TTS"
    : ttsProvider === "elevenlabs"
      ? "ElevenLabs"
      : ttsProvider === "openrouter-tts"
        ? "OpenRouter TTS"
        : ttsProvider === "fish-audio"
          ? "Fish Audio"
          : ttsProvider === "fal-ai"
            ? "fal.ai"
            : engine === "kokoro"
            ? "Kokoro"
            : "Local";

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Figuren-Stimmen" backHref={`/story/${storyId}`} />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        <p className="text-[11px] leading-snug text-zinc-500">
          {engineLabel} pro Sprecher — inkl.{" "}
          <strong className="text-zinc-400">Protagonist (du)</strong> unter Erzähler.
          Gleiche Karte auch im{" "}
          <Link href={`/story/${storyId}`} className="text-accent underline">
            Story-Hub → Cast
          </Link>
          . ·{" "}
          <Link href="/settings" className="text-accent underline">
            Engine
          </Link>
          {qwen ? (
            <>
              {" "}
              ·{" "}
              <Link href="/dev/qwen-voices" className="text-accent underline">
                Stimmen-Labor
              </Link>
            </>
          ) : null}
        </p>

        {qwen ? (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2">
            <input
              type="checkbox"
              checked={qwenSceneInstruct}
              onChange={(e) => setQwenSceneInstruct(e.target.checked)}
              className="mt-0.5 size-3.5 rounded border-surface-border"
            />
            <span className="text-xs text-zinc-400">
              <strong className="text-zinc-200">Szenen-Stil</strong> aus
              Plot-State (Ort, Bedrohungen, Threads) — kombiniert mit
              Figuren-instruct.
            </span>
          </label>
        ) : null}

        <ul className="flex flex-col gap-2">
          {speakers.map((s) => {
            const voiceActive =
              s.isNarrator ||
              s.isProtagonist ||
              voiceEnabledSlugs.includes(s.slug);
            const voiceDisabled =
              !s.isNarrator &&
              !s.isProtagonist &&
              !voiceEnabledSlugs.includes(s.slug);
            const currentVoice =
              voiceMap[s.slug] ?? defaults[s.slug] ?? fallback;
            const expanded = expandedSlug === s.slug;
            const profile =
              qwenProfiles[s.slug] ?? emptyQwenProfile(s.slug);

            return (
              <li
                key={s.slug}
                className={`rounded-lg border px-2.5 py-2 ${
                  voiceActive
                    ? "border-surface-border bg-surface-raised"
                    : "border-surface-border/50 bg-surface-raised/60"
                }`}
              >
                <button
                  type="button"
                  className="mb-1.5 flex w-full items-center gap-2 text-left"
                  onClick={() =>
                    setExpandedSlug(expanded ? null : s.slug)
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-200">
                      {s.name}
                    </p>
                    <p className="truncate text-[10px] text-zinc-600">
                      {s.slug}
                      {qwen && profile.designInstruct?.trim()
                        ? " · instruct"
                        : ""}
                    </p>
                  </div>
                  {s.isNarrator ? (
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-accent">
                      Erzähler
                    </span>
                  ) : s.isProtagonist ? (
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-zinc-400">
                      Du
                    </span>
                  ) : (
                    <label
                      className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] text-zinc-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={voiceEnabledSlugs.includes(s.slug)}
                        onChange={(e) =>
                          toggleVoiceActive(s.slug, e.target.checked)
                        }
                        className="size-3 rounded border-surface-border"
                      />
                      Eigene
                    </label>
                  )}
                  <span className="text-[10px] text-zinc-600">
                    {expanded ? "▲" : "▼"}
                  </span>
                </button>

                {voiceDisabled ? (
                  <p className="mb-1 text-[10px] text-zinc-600">
                    → Erzähler-Stimme
                  </p>
                ) : null}

                {expanded && !voiceDisabled ? (
                  qwen ? (
                    <QwenVoiceEditor
                      profile={profile}
                      onChange={(next) => updateQwenProfile(s.slug, next)}
                      locale={storyLocale}
                      compact={!s.isNarrator}
                    />
                  ) : ttsProvider === "elevenlabs" ? (
                    <ElevenLabsVoiceSelect
                      value={currentVoice}
                      onChange={(id) =>
                        setVoiceMap((prev) => ({ ...prev, [s.slug]: id }))
                      }
                    />
                  ) : ttsProvider === "openrouter-tts" ? (
                    <OpenRouterTtsVoiceSelect
                      model={orTtsModel}
                      value={currentVoice}
                      onChange={(id) =>
                        setVoiceMap((prev) => ({ ...prev, [s.slug]: id }))
                      }
                      allowCustom
                    />
                  ) : ttsProvider === "fish-audio" ? (
                    <FishAudioVoiceSelect
                      value={currentVoice}
                      onChange={(id) =>
                        setVoiceMap((prev) => ({ ...prev, [s.slug]: id }))
                      }
                      fishModel={fishModel}
                      pinnedIds={fishPinnedIds}
                      onPinnedIdsChange={(ids) => {
                        setFishPinnedIds(ids);
                        saveFishAudioPinnedIds(ids);
                      }}
                      allowCustom
                    />
                  ) : ttsProvider === "fal-ai" ? (
                    <FalTtsVoiceSelect
                      model={falTtsModel}
                      value={currentVoice}
                      onChange={(id) =>
                        setVoiceMap((prev) => ({ ...prev, [s.slug]: id }))
                      }
                      allowCustom
                    />
                  ) : (
                    <select
                      value={currentVoice}
                      onChange={(e) =>
                        setVoiceMap((prev) => ({
                          ...prev,
                          [s.slug]: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs"
                    >
                      {voiceOptions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  )
                ) : !voiceDisabled && qwen ? (
                  <p className="text-[10px] text-zinc-600">
                    {profile.presetSpeaker} — antippen zum Bearbeiten & ▶
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={save}
          className="rounded-xl bg-accent py-2.5 text-sm font-medium text-black"
        >
          Stimmen speichern
        </button>
        {saved ? (
          <p className="text-center text-xs text-green-400">Gespeichert</p>
        ) : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </main>
  );
}

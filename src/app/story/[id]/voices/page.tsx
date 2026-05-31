"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ElevenLabsVoiceSelect } from "@/components/ElevenLabsVoiceSelect";
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
} from "@/lib/tts/defaultVoiceMap";
import { ELEVEN_DEFAULT_NARRATOR } from "@/lib/tts/elevenLabsVoices";
import { KOKORO_VOICES } from "@/lib/tts/kokoroVoices";
import {
  QWEN_DEFAULT_NARRATOR,
  QWEN_VOICES,
} from "@/lib/tts/qwenVoices";
import { loadTtsSettings, type TtsProvider } from "@/lib/storage/ttsSettings";
import { defaultEnabledCastSlugs } from "@/lib/tts/voiceActivation";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";
import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import type { VoiceMap } from "@/lib/types";

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
  return engine === "qwen" ? QWEN_DEFAULT_NARRATOR : "af_bella";
}

export default function StoryVoicesPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [cast, setCast] = useState<
    Awaited<ReturnType<typeof listCharacters>>
  >([]);
  const [voiceMap, setVoiceMap] = useState<VoiceMap>({});
  const [voiceEnabledSlugs, setVoiceEnabledSlugs] = useState<string[]>([]);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>("elevenlabs");
  const [localEngine, setLocalEngine] = useState<LocalTtsEngine>("kokoro");
  const [storyLocale, setStoryLocale] = useState<"de" | "en">("de");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            const castRows = chars.filter(
              (c) => c.role === "cast" || c.role === "narrator",
            );
            setCast(castRows);
            setVoiceMap(
              mergeVoiceMapForProvider(tts.provider, locale, settings.voiceMap),
            );
            setVoiceEnabledSlugs(
              settings.voiceEnabledSlugs ??
                defaultEnabledCastSlugs(castRows),
            );
          })
          .catch((e) => setError(String(e)));
      });
  }, [storyId, router]);

  const engine =
    localEngine === "qwen" || localEngine === "kokoro" ? localEngine : "kokoro";
  const voiceOptions = voiceOptionsForEngine(engine);
  const defaults =
    ttsProvider === "elevenlabs"
      ? mergeVoiceMapForProvider("elevenlabs", storyLocale, null)
      : defaultMapForEngine(engine);
  const fallback = fallbackVoice(ttsProvider, engine);

  const narrator = cast.find((c) => c.role === "narrator");
  const castSpeakers = cast
    .filter((c) => c.role === "cast" && (c.status ?? "active") === "active")
    .map((c) => ({ slug: c.slug, name: c.name }));
  const speakers = [
    { slug: "narrator", name: narrator?.name ?? "Narrator", isNarrator: true },
    ...castSpeakers.map((c) => ({ ...c, isNarrator: false })),
  ];

  const toggleVoiceActive = (slug: string, active: boolean) => {
    setVoiceEnabledSlugs((prev) => {
      const has = prev.includes(slug);
      if (active && !has) return [...prev, slug];
      if (!active && has) return prev.filter((s) => s !== slug);
      return prev;
    });
  };

  const save = async () => {
    setError(null);
    try {
      await updateStorySettings(storyId, { voiceMap, voiceEnabledSlugs });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    }
  };

  const engineLabel =
    ttsProvider === "elevenlabs"
      ? "ElevenLabs"
      : engine === "qwen"
        ? "Qwen3-TTS"
        : "Kokoro";

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Figuren-Stimmen" backHref={`/story/${storyId}`} />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        <p className="text-[11px] leading-snug text-zinc-500">
          {engineLabel} pro Sprecher ·{" "}
          <Link href="/settings" className="text-accent underline">
            Engine
          </Link>
          {ttsProvider === "elevenlabs" ? (
            <> · {storyLocale === "de" ? "DE" : "EN"}</>
          ) : null}
          . ▶ = kostenlose ElevenLabs-Vorschau.
        </p>

        <ul className="flex flex-col gap-2">
          {speakers.map((s) => {
            const voiceActive =
              s.isNarrator || voiceEnabledSlugs.includes(s.slug);
            const voiceDisabled =
              !s.isNarrator && !voiceEnabledSlugs.includes(s.slug);
            const currentVoice =
              voiceMap[s.slug] ?? defaults[s.slug] ?? fallback;

            return (
              <li
                key={s.slug}
                className={`rounded-lg border px-2.5 py-2 ${
                  voiceActive
                    ? "border-surface-border bg-surface-raised"
                    : "border-surface-border/50 bg-surface-raised/60"
                }`}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-200">
                      {s.name}
                    </p>
                    <p className="truncate text-[10px] text-zinc-600">
                      {s.slug}
                    </p>
                  </div>
                  {s.isNarrator ? (
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-accent">
                      Erzähler
                    </span>
                  ) : (
                    <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] text-zinc-500">
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
                </div>

                {voiceDisabled ? (
                  <p className="mb-1 text-[10px] text-zinc-600">
                    → Erzähler-Stimme
                  </p>
                ) : null}

                {ttsProvider === "elevenlabs" ? (
                  <ElevenLabsVoiceSelect
                    value={currentVoice}
                    onChange={(id) =>
                      setVoiceMap((prev) => ({ ...prev, [s.slug]: id }))
                    }
                    disabled={voiceDisabled}
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
                    disabled={voiceDisabled}
                    className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs disabled:opacity-50"
                  >
                    {voiceOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                )}
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

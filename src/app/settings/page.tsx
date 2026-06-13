"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DecimalStepInput } from "@/components/DecimalStepInput";
import {
  clearOpenRouterApiKey,
  loadOpenRouterSettings,
  saveOpenRouterSettings,
} from "@/lib/storage/openRouterSettings";
import { DEFAULT_OPENROUTER } from "@/lib/types";
import {
  DEFAULT_TTS,
  loadTtsSettings,
  saveTtsSettings,
  type TtsProvider,
  isBetaTtsProvider,
} from "@/lib/storage/ttsSettings";
import { KokoroVoicePicker } from "@/components/KokoroVoicePicker";
import { QwenVoicePicker } from "@/components/QwenVoicePicker";
import { QWEN_CLOUD_DEFAULT_NARRATOR } from "@/lib/tts/qwenCloudVoices";
import {
  LOCAL_TTS_PRESETS,
  type LocalTtsEngine,
} from "@/lib/storage/ttsPresets";
import {
  parsePronunciationLines,
  serializePronunciationMap,
} from "@/lib/tts/pronunciation";
import { useServerCapabilities } from "@/lib/server/useServerCapabilities";
import { ElevenLabsVoiceSelect } from "@/components/ElevenLabsVoiceSelect";
import { ELEVEN_DEFAULT_MODEL } from "@/lib/tts/elevenLabsVoices";
import {
  ELEVEN_TTS_MODEL_OPTIONS,
  normalizeElevenLabsModelId,
} from "@/lib/tts/elevenLabsModels";
import { LlmUsagePanel } from "@/components/LlmUsagePanel";
import {
  FISH_AUDIO_MODEL_OPTIONS,
  DEFAULT_FISH_AUDIO_REFERENCE_ID,
} from "@/lib/tts/fishAudioVoices";
import {
  OPENROUTER_TTS_MODEL_OPTIONS,
  normalizeOpenRouterTtsModel,
  normalizeOpenRouterTtsVoice,
  openRouterTtsModelMeta,
} from "@/lib/tts/openRouterTtsModels";
import {
  PREFS_UPDATED_EVENT,
  syncUserPreferences,
} from "@/lib/storage/userPreferencesSync";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  pickAllowedModel,
  useLlmModelCatalog,
} from "@/lib/llm/useLlmModelCatalog";

const MAX_TOKENS_MIN = 256;
const MAX_TOKENS_MAX = 8192;

export default function SettingsPage() {
  const serverCaps = useServerCapabilities();
  const serverLlm = serverCaps.serverLlm;
  const serverElevenLabsTts = serverCaps.serverElevenLabsTts;
  const serverOpenRouterTts = serverCaps.serverOpenRouterTts;
  const serverFishAudioTts = serverCaps.serverFishAudioTts;
  const serverQwenTts = serverCaps.serverQwenTts;
  const serverQwenCloudTts = serverCaps.serverQwenCloudTts;
  const capsReady = serverCaps.ready;
  const betaMode = capsReady && serverLlm;
  const { models: llmModels, loading: modelsLoading } = useLlmModelCatalog();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_OPENROUTER.model);
  const [narratorModel, setNarratorModel] = useState("");
  const [maxTokens, setMaxTokens] = useState(DEFAULT_OPENROUTER.maxTokens);
  const [temperature, setTemperature] = useState(
    DEFAULT_OPENROUTER.temperature,
  );
  const [saved, setSaved] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>("local");
  const [localEngine, setLocalEngine] = useState<LocalTtsEngine>("edge");
  const [localUrl, setLocalUrl] = useState(DEFAULT_TTS.localServerUrl);
  const [localVoice, setLocalVoice] = useState(DEFAULT_TTS.localVoice);
  const [elApiKey, setElApiKey] = useState("");
  const [elVoiceId, setElVoiceId] = useState(DEFAULT_TTS.elevenLabsVoiceId);
  const [elModelId, setElModelId] = useState(DEFAULT_TTS.elevenLabsModelId);
  const [orTtsModel, setOrTtsModel] = useState(DEFAULT_TTS.openRouterTtsModel);
  const [orTtsVoice, setOrTtsVoice] = useState(DEFAULT_TTS.openRouterTtsVoice);
  const [fishModel, setFishModel] = useState(DEFAULT_TTS.fishAudioModel);
  const [fishRefId, setFishRefId] = useState(DEFAULT_TTS.fishAudioReferenceId);
  const [pronunciationText, setPronunciationText] = useState("");
  const [ttsSaved, setTtsSaved] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const selectedModelMeta = useMemo(
    () => llmModels.find((m) => m.id === model),
    [llmModels, model],
  );

  const selectedNarratorMeta = useMemo(
    () =>
      narratorModel.trim()
        ? llmModels.find((m) => m.id === narratorModel)
        : null,
    [llmModels, narratorModel],
  );

  const reloadFromStorage = useCallback(() => {
    const s = loadOpenRouterSettings();
    if (s) {
      setApiKey(s.apiKey);
      setModel(s.model);
      setNarratorModel(s.narratorModel ?? "");
      setMaxTokens(s.maxTokens);
      setTemperature(s.temperature);
    }
    const tts = loadTtsSettings();
    let provider = tts.provider;
    if (betaMode && !isBetaTtsProvider(provider)) {
      provider = "elevenlabs";
      saveTtsSettings({ ...tts, provider }, { sync: false });
    }
    setTtsProvider(provider);
    setLocalEngine(tts.localEngine ?? "edge");
    setLocalUrl(tts.localServerUrl);
    setLocalVoice(tts.localVoice);
    setElApiKey(tts.elevenLabsApiKey);
    setElVoiceId(tts.elevenLabsVoiceId);
    setElModelId(tts.elevenLabsModelId);
    setOrTtsModel(tts.openRouterTtsModel);
    setOrTtsVoice(tts.openRouterTtsVoice);
    setFishModel(tts.fishAudioModel);
    setFishRefId(tts.fishAudioReferenceId);
    setPronunciationText(serializePronunciationMap(tts.pronunciationMap ?? {}));
  }, [betaMode]);

  useEffect(() => {
    reloadFromStorage();
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        setLoggedIn(Boolean(data.user));
      });
      void syncUserPreferences().then(() => reloadFromStorage());
    }
    const onPrefsUpdated = () => reloadFromStorage();
    window.addEventListener(PREFS_UPDATED_EVENT, onPrefsUpdated);
    return () => window.removeEventListener(PREFS_UPDATED_EVENT, onPrefsUpdated);
  }, [reloadFromStorage]);

  useEffect(() => {
    if (!betaMode || !llmModels.length) return;
    setModel((current) => pickAllowedModel(current, llmModels));
    setNarratorModel((current) =>
      current.trim() ? pickAllowedModel(current, llmModels) : "",
    );
  }, [betaMode, llmModels]);

  const saveLlm = () => {
    const allowedModel = betaMode
      ? pickAllowedModel(model, llmModels)
      : model.trim();
    const allowedNarrator = betaMode
      ? narratorModel.trim()
        ? pickAllowedModel(narratorModel, llmModels)
        : undefined
      : narratorModel.trim() || undefined;
    saveOpenRouterSettings({
      apiKey: apiKey.trim(),
      model: allowedModel,
      narratorModel:
        allowedNarrator && allowedNarrator !== allowedModel
          ? allowedNarrator
          : undefined,
      maxTokens: Math.min(
        MAX_TOKENS_MAX,
        Math.max(MAX_TOKENS_MIN, maxTokens),
      ),
      temperature,
    });
    setModel(allowedModel);
    setNarratorModel(
      allowedNarrator && allowedNarrator !== allowedModel
        ? allowedNarrator
        : "",
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearKey = () => {
    clearOpenRouterApiKey();
    setApiKey("");
  };

  const applyEnginePreset = (engine: LocalTtsEngine) => {
    setLocalEngine(engine);
    if (engine === "custom") return;
    const p = LOCAL_TTS_PRESETS[engine];
    setLocalUrl(p.serverUrl);
    setLocalVoice(p.defaultVoice);
  };

  useEffect(() => {
    if (
      (ttsProvider === "qwen" || ttsProvider === "qwen-cloud") &&
      localEngine !== "qwen"
    ) {
      applyEnginePreset("qwen");
    }
  }, [ttsProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedOrTtsMeta = useMemo(
    () => openRouterTtsModelMeta(orTtsModel),
    [orTtsModel],
  );

  const saveTts = () => {
    saveTtsSettings({
      provider: ttsProvider,
      localEngine,
      localServerUrl: localUrl.trim(),
      localVoice: localVoice.trim(),
      elevenLabsApiKey: elApiKey.trim(),
      elevenLabsVoiceId: elVoiceId.trim(),
      elevenLabsModelId: elModelId.trim(),
      openRouterTtsModel: orTtsModel.trim(),
      openRouterTtsVoice: orTtsVoice.trim(),
      fishAudioModel: fishModel.trim(),
      fishAudioReferenceId: fishRefId.trim(),
      pronunciationMap: parsePronunciationLines(pronunciationText),
    });
    setTtsSaved(true);
    setTimeout(() => setTtsSaved(false), 2000);
  };

  const persistTtsFromState = useCallback(
    (overrides?: {
      ttsProvider?: TtsProvider;
      elVoiceId?: string;
      elModelId?: string;
      localVoice?: string;
      orTtsModel?: string;
      orTtsVoice?: string;
      fishModel?: string;
      fishRefId?: string;
    }) => {
      const provider = overrides?.ttsProvider ?? ttsProvider;
      const voiceId = (overrides?.elVoiceId ?? elVoiceId).trim();
      const modelId = (overrides?.elModelId ?? elModelId).trim();
      const qwenVoice = (overrides?.localVoice ?? localVoice).trim();
      const nextOrModel = normalizeOpenRouterTtsModel(
        overrides?.orTtsModel ?? orTtsModel,
      );
      const nextOrVoice = normalizeOpenRouterTtsVoice(
        nextOrModel,
        overrides?.orTtsVoice ?? orTtsVoice,
      );
      const nextFishModel = (overrides?.fishModel ?? fishModel).trim() || "s2-pro";
      const nextFishRef =
        (overrides?.fishRefId ?? fishRefId).trim() ||
        DEFAULT_FISH_AUDIO_REFERENCE_ID;

      const shared = {
        elevenLabsApiKey: elApiKey.trim(),
        elevenLabsVoiceId: voiceId || elVoiceId.trim(),
        elevenLabsModelId: modelId || elModelId.trim(),
        openRouterTtsModel: nextOrModel,
        openRouterTtsVoice: nextOrVoice,
        fishAudioModel: nextFishModel,
        fishAudioReferenceId: nextFishRef,
        pronunciationMap: parsePronunciationLines(pronunciationText),
      };

      if (provider === "qwen" || provider === "qwen-cloud") {
        saveTtsSettings({
          provider,
          localEngine: "qwen",
          localServerUrl:
            localUrl.trim() || LOCAL_TTS_PRESETS.qwen.serverUrl,
          localVoice:
            qwenVoice ||
            (provider === "qwen-cloud"
              ? QWEN_CLOUD_DEFAULT_NARRATOR
              : "Ryan"),
          ...shared,
        });
      } else if (provider === "openrouter-tts") {
        saveTtsSettings({
          provider,
          localEngine,
          localServerUrl: localUrl.trim(),
          localVoice: qwenVoice || localVoice.trim(),
          ...shared,
        });
      } else if (provider === "fish-audio") {
        saveTtsSettings({
          provider,
          localEngine,
          localServerUrl: localUrl.trim(),
          localVoice: qwenVoice || localVoice.trim(),
          ...shared,
        });
      } else {
        saveTtsSettings({
          provider: "elevenlabs",
          localEngine,
          localServerUrl: localUrl.trim(),
          localVoice: qwenVoice || localVoice.trim(),
          ...shared,
        });
      }
      setTtsSaved(true);
      setTimeout(() => setTtsSaved(false), 2000);
    },
    [
      ttsProvider,
      localEngine,
      localUrl,
      localVoice,
      elApiKey,
      elVoiceId,
      elModelId,
      orTtsModel,
      orTtsVoice,
      fishModel,
      fishRefId,
      pronunciationText,
    ],
  );

  const saveBetaTts = () => {
    persistTtsFromState();
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Settings" backHref="/" />
      <div className="flex flex-col gap-5 p-4">
        {loggedIn ? (
          <p className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs text-zinc-400">
            Modell, Temperatur und Erzähler-Stimme werden mit deinem Account
            synchronisiert (Handy ↔ Desktop). Hintergrund- und Erzähler-Modell
            getrennt — spart Budget bei Memory-Sync.
          </p>
        ) : null}

        {betaMode ? (
          <>
            <LlmUsagePanel />

            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-1 font-medium text-accent">LLM — Modelle</h2>
              <p className="mb-3 text-xs text-zinc-500">
                <strong>Hintergrund</strong> für Memory, Zusammenfassungen und
                JSON — <strong>Erzähler</strong> für Story-Chat und
                Beat-Vorschläge. Kosten pro Modell auf dein Monatsbudget.
              </p>

              <label className="mb-1 block text-xs text-zinc-400">
                Hintergrund-Modell
              </label>
              {modelsLoading && !llmModels.length ? (
                <p className="mb-3 text-sm text-zinc-500">Modelle laden…</p>
              ) : (
                <select
                  value={pickAllowedModel(model, llmModels)}
                  onChange={(e) => setModel(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-100"
                >
                  {llmModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
              {selectedModelMeta ? (
                <p className="mb-3 text-[11px] text-zinc-500">
                  {selectedModelMeta.priceHint}
                </p>
              ) : null}

              <label className="mb-1 block text-xs text-zinc-400">
                Erzähler-Modell (Story-Chat)
              </label>
              {modelsLoading && !llmModels.length ? (
                <p className="mb-3 text-sm text-zinc-500">Modelle laden…</p>
              ) : (
                <select
                  value={narratorModel}
                  onChange={(e) => setNarratorModel(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">— gleich wie Hintergrund —</option>
                  {llmModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
              {selectedNarratorMeta ? (
                <p className="mb-3 text-[11px] text-zinc-500">
                  {selectedNarratorMeta.priceHint}
                </p>
              ) : (
                <p className="mb-3 text-[11px] text-zinc-600">
                  Ohne Auswahl nutzt der Chat das Hintergrund-Modell.
                </p>
              )}

              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Max. Tokens
                  </label>
                  <input
                    type="number"
                    min={MAX_TOKENS_MIN}
                    max={MAX_TOKENS_MAX}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Temperatur
                  </label>
                  <DecimalStepInput
                    ariaLabel="Temperatur"
                    value={temperature}
                    min={0}
                    max={2}
                    step={0.05}
                    decimals={2}
                    onChange={setTemperature}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={saveLlm}
                className="w-full rounded-lg bg-accent py-2 text-sm font-medium text-black"
              >
                LLM-Einstellungen speichern
              </button>
              {saved ? (
                <p className="mt-2 text-center text-xs text-green-400">
                  Gespeichert
                </p>
              ) : null}
            </section>

            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-1 font-medium text-accent">Sprachausgabe (TTS)</h2>
              <p className="mb-3 text-xs text-zinc-500">
                <strong>ElevenLabs</strong> = Premium.{" "}
                <strong>OpenRouter TTS</strong> = günstige Cloud-Modelle
                (Gemini, Kokoro, Voxtral).{" "}
                <strong>Fish Audio</strong> = S2-Pro mit Emotion-Tags wie{" "}
                <code className="text-zinc-400">[whisper]</code>. Cast-Stimmen
                pro Story unter Figuren-Stimmen.
              </p>

              <div className="mb-3 flex flex-wrap gap-2">
                {(
                  [
                    { id: "elevenlabs" as const, label: "ElevenLabs" },
                    { id: "openrouter-tts" as const, label: "OpenRouter TTS" },
                    { id: "fish-audio" as const, label: "Fish Audio" },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTtsProvider(id);
                      persistTtsFromState({ ttsProvider: id });
                    }}
                    className={`min-w-[30%] flex-1 rounded-lg py-2 text-xs sm:text-sm ${
                      ttsProvider === id
                        ? "bg-accent text-black"
                        : "border border-surface-border text-zinc-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {ttsProvider === "elevenlabs" ? (
                <>
                  {serverElevenLabsTts ? (
                    <p className="mb-2 text-xs text-zinc-500">
                      Server-Key aktiv — TTS läuft über Vercel (kein eigener Key nötig).
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 text-xs text-amber-200">
                        Kein ElevenLabs-Server-Key — eigenen Key eintragen (nur in
                        diesem Browser, wird nicht mit dem Account synchronisiert)
                        oder{" "}
                        <code className="text-amber-100">ELEVENLABS_API_KEY</code>{" "}
                        in Vercel setzen.
                      </p>
                      <label className="mb-1 block text-xs text-zinc-400">
                        ElevenLabs API-Key
                      </label>
                      <input
                        type="password"
                        value={elApiKey}
                        onChange={(e) => setElApiKey(e.target.value)}
                        className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                        placeholder="xi-…"
                        autoComplete="off"
                      />
                    </>
                  )}
                  <ElevenLabsVoiceSelect
                    value={elVoiceId}
                    onChange={(id) => {
                      setElVoiceId(id);
                      persistTtsFromState({
                        ttsProvider: "elevenlabs",
                        elVoiceId: id,
                      });
                    }}
                    label="Erzähler-Stimme"
                  />
                  <p className="mb-2 text-[11px] text-zinc-600">
                    Stimme wird beim Auswählen automatisch gespeichert.
                  </p>
                  <label className="mt-3 block text-xs text-zinc-400">
                    TTS-Modell
                    <select
                      value={normalizeElevenLabsModelId(elModelId)}
                      onChange={(e) => {
                        const nextModel = normalizeElevenLabsModelId(
                          e.target.value,
                        );
                        setElModelId(nextModel);
                        persistTtsFromState({
                          ttsProvider: "elevenlabs",
                          elModelId: nextModel,
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2 py-2 text-sm"
                    >
                      {ELEVEN_TTS_MODEL_OPTIONS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} — {m.hint}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    Günstig testen: Flash oder Turbo. Standard: Multilingual v2.
                    v3 nur mit Szenen-Stil (Cast).
                  </p>
                </>
              ) : ttsProvider === "openrouter-tts" ? (
                <>
                  {!serverOpenRouterTts ? (
                    <p className="mb-2 text-xs text-amber-200">
                      OpenRouter TTS nicht aktiv —{" "}
                      <code className="text-amber-100">OPENROUTER_API_KEY</code>{" "}
                      in Vercel/.env setzen (gleicher Key wie LLM).
                    </p>
                  ) : (
                    <p className="mb-2 text-xs text-zinc-500">
                      OpenRouter TTS aktiv — Abrechnung über dein OpenRouter-Guthaben.
                    </p>
                  )}
                  <label className="mb-1 block text-xs text-zinc-400">
                    TTS-Modell
                  </label>
                  <select
                    value={normalizeOpenRouterTtsModel(orTtsModel)}
                    onChange={(e) => {
                      const nextModel = normalizeOpenRouterTtsModel(e.target.value);
                      const nextVoice = openRouterTtsModelMeta(nextModel).defaultVoice;
                      setOrTtsModel(nextModel);
                      setOrTtsVoice(nextVoice);
                      persistTtsFromState({
                        ttsProvider: "openrouter-tts",
                        orTtsModel: nextModel,
                        orTtsVoice: nextVoice,
                      });
                    }}
                    className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-2 py-2 text-sm"
                  >
                    {OPENROUTER_TTS_MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} — {m.hint}
                      </option>
                    ))}
                  </select>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Erzähler-Stimme
                  </label>
                  <select
                    value={normalizeOpenRouterTtsVoice(orTtsModel, orTtsVoice)}
                    onChange={(e) => {
                      setOrTtsVoice(e.target.value);
                      persistTtsFromState({
                        ttsProvider: "openrouter-tts",
                        orTtsVoice: e.target.value,
                      });
                    }}
                    className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-2 py-2 text-sm"
                  >
                    {selectedOrTtsMeta.voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-600">
                    Günstigster Einstieg: Kokoro 82M. Cast-Stimmen unter
                    Figuren-Stimmen (Voice-ID pro Sprecher).
                  </p>
                </>
              ) : (
                <>
                  {!serverFishAudioTts ? (
                    <p className="mb-2 text-xs text-amber-200">
                      Fish Audio nicht aktiv —{" "}
                      <code className="text-amber-100">FISH_AUDIO_API_KEY</code>{" "}
                      in Vercel/.env setzen.
                    </p>
                  ) : (
                    <p className="mb-2 text-xs text-zinc-500">
                      Fish Audio S2-Pro aktiv — Emotion-Tags inline, z. B.{" "}
                      <code className="text-zinc-400">[excited]</code> oder{" "}
                      <code className="text-zinc-400">[whisper]</code>.
                    </p>
                  )}
                  <label className="mb-1 block text-xs text-zinc-400">
                    Modell
                  </label>
                  <select
                    value={fishModel}
                    onChange={(e) => {
                      setFishModel(e.target.value);
                      persistTtsFromState({
                        ttsProvider: "fish-audio",
                        fishModel: e.target.value,
                      });
                    }}
                    className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-2 py-2 text-sm"
                  >
                    {FISH_AUDIO_MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} — {m.hint}
                      </option>
                    ))}
                  </select>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Erzähler reference_id
                  </label>
                  <input
                    value={fishRefId}
                    onChange={(e) => setFishRefId(e.target.value)}
                    onBlur={() =>
                      persistTtsFromState({ ttsProvider: "fish-audio" })
                    }
                    className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                    placeholder={DEFAULT_FISH_AUDIO_REFERENCE_ID}
                    autoComplete="off"
                  />
                  <p className="text-[10px] text-zinc-600">
                    Voice-ID aus der{" "}
                    <a
                      href="https://fish.audio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline"
                    >
                      Fish Audio Voice Library
                    </a>
                    . Pro Cast-Figur eigene ID unter Figuren-Stimmen.
                  </p>
                </>
              )}

              <button
                type="button"
                onClick={saveBetaTts}
                className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-medium text-black"
              >
                TTS-Einstellungen speichern
              </button>
              {ttsSaved ? (
                <p className="mt-2 text-center text-xs text-green-400">
                  Gespeichert
                </p>
              ) : null}
            </section>
          </>
        ) : (
          <>
            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-1 font-medium text-accent">OpenRouter</h2>
              {!capsReady ? (
                <p className="mb-3 text-xs text-zinc-500">
                  Server-Konfiguration wird geprüft…
                </p>
              ) : (
                <p className="mb-3 text-xs text-zinc-500">
                  Lokaler Dev-Modus ohne Server-LLM — API-Key im Browser.
                </p>
              )}
              <label className="mb-1 block text-xs text-zinc-400">API key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                placeholder="sk-or-…"
                autoComplete="off"
              />
              <label className="mb-1 block text-xs text-zinc-400">
                Hintergrund-Modell (Memory, Sync, JSON)
              </label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-xs text-zinc-400">
                Erzähler-Modell (Story-Chat, optional)
              </label>
              <input
                value={narratorModel}
                onChange={(e) => setNarratorModel(e.target.value)}
                className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                placeholder="e.g. aion-labs/aion-2.0"
              />
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Max tokens
                  </label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Temperature
                  </label>
                  <DecimalStepInput
                    ariaLabel="Temperatur"
                    value={temperature}
                    min={0}
                    max={2}
                    step={0.05}
                    decimals={2}
                    onChange={setTemperature}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveLlm}
                  className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-black"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={clearKey}
                  className="rounded-lg border border-surface-border px-3 py-2 text-sm text-zinc-400"
                >
                  Clear key
                </button>
              </div>
              {saved ? (
                <p className="mt-2 text-center text-xs text-green-400">Saved</p>
              ) : null}
            </section>

            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-1 font-medium text-accent">Narrator TTS</h2>
              <p className="mb-3 text-xs text-zinc-500">
                <strong>Local (free)</strong> uses a small server on your PC.
                See <code className="text-zinc-400">docs/LOCAL-TTS.md</code>.
              </p>
          <div className="mb-3 flex gap-2">
            {(["local", "qwen", "elevenlabs"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTtsProvider(p)}
                className={`flex-1 rounded-lg py-2 text-sm ${
                  ttsProvider === p
                    ? "bg-accent text-black"
                    : "border border-surface-border text-zinc-400"
                }`}
              >
                {p === "local"
                  ? "Local (free)"
                  : p === "qwen"
                    ? "Qwen (GPU)"
                    : "ElevenLabs"}
              </button>
            ))}
          </div>
          {ttsProvider === "local" || ttsProvider === "qwen" ? (
            <>
              {ttsProvider === "local" ? (
                <>
                  <label className="mb-1 block text-xs text-zinc-400">Engine</label>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {(
                      ["edge", "kokoro", "qwen", "custom"] as LocalTtsEngine[]
                    ).map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => applyEnginePreset(e)}
                        className={`rounded-lg px-2 py-2 text-xs ${
                          localEngine === e
                            ? "bg-accent/20 text-accent"
                            : "border border-surface-border text-zinc-500"
                        }`}
                      >
                        {e === "edge"
                          ? "edge-tts"
                          : e === "custom"
                            ? "Custom"
                            : e}
                      </button>
                    ))}
                  </div>
                  {localEngine !== "custom" ? (
                    <p className="mb-2 text-xs text-zinc-600">
                      {LOCAL_TTS_PRESETS[localEngine].label} —{" "}
                      {LOCAL_TTS_PRESETS[localEngine].docs}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mb-2 text-xs text-zinc-500">
                  Lokal: <code className="text-accent">npm run tts:qwen</code>{" "}
                  oder RunPod — siehe{" "}
                  <code className="text-zinc-400">docs/RUNPOD-QWEN.md</code>
                </p>
              )}
              <p className="mb-2 text-xs text-zinc-500">
                PC:{" "}
                <code className="text-accent">
                  {ttsProvider === "qwen" || localEngine === "qwen"
                    ? "npm run tts:qwen"
                    : localEngine === "kokoro"
                      ? "npm run tts:kokoro"
                      : "npm run tts:server"}
                </code>{" "}
                + <code className="text-accent">npm run dev</code>
                {localEngine === "kokoro" && ttsProvider === "local" ? (
                  <>
                    <br />
                    First time:{" "}
                    <code className="text-zinc-400">
                      .\scripts\install-kokoro.ps1
                    </code>
                    <br />
                    HF token in <code className="text-zinc-400">.env.local</code>
                    : <code className="text-zinc-400">HF_TOKEN=hf_...</code>
                  </>
                ) : null}
                {(ttsProvider === "qwen" || localEngine === "qwen") ? (
                  <>
                    <br />
                    First time:{" "}
                    <code className="text-zinc-400">npm run tts:qwen:install</code>
                    <br />
                    HF token in <code className="text-zinc-400">.env.local</code>
                    : <code className="text-zinc-400">HF_TOKEN=hf_...</code>
                    <br />
                    <Link href="/dev/qwen-voices" className="text-accent underline">
                      Qwen Stimmen-Labor
                    </Link>{" "}
                    — Presets & instruct testen
                  </>
                ) : null}
              </p>
              <label className="mb-1 block text-xs text-zinc-400">
                Server URL
              </label>
              <input
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
              {(ttsProvider === "qwen" || localEngine === "qwen") ? (
                <QwenVoicePicker
                  serverUrl={localUrl}
                  value={localVoice}
                  onChange={setLocalVoice}
                  serverProxy={serverQwenTts}
                />
              ) : localEngine === "kokoro" ? (
                <KokoroVoicePicker
                  serverUrl={localUrl}
                  value={localVoice}
                  onChange={setLocalVoice}
                />
              ) : (
                <>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Voice
                  </label>
                  <input
                    value={localVoice}
                    onChange={(e) => setLocalVoice(e.target.value)}
                    className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                    placeholder="en-US-AndrewNeural"
                  />
                </>
              )}
            </>
          ) : (
            <>
              <label className="mb-1 block text-xs text-zinc-400">
                API key
              </label>
              <input
                type="password"
                value={elApiKey}
                onChange={(e) => setElApiKey(e.target.value)}
                className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
                placeholder="xi-…"
                autoComplete="off"
              />
              <ElevenLabsVoiceSelect
                value={elVoiceId}
                onChange={setElVoiceId}
                label="Erzähler-Stimme"
              />
              <p className="mb-3 text-[11px] text-zinc-600">
                ▶ spielt die kostenlose ElevenLabs-Standardvorschau ab (keine
                Story-Tokens).
              </p>
              <label className="mb-1 block text-xs text-zinc-400">Model</label>
              <input
                value={elModelId}
                onChange={(e) => setElModelId(e.target.value)}
                className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
            </>
          )}
          <label className="mb-1 mt-3 block text-xs text-zinc-400">
            Aussprache-Overrides (global)
          </label>
          <textarea
            value={pronunciationText}
            onChange={(e) => setPronunciationText(e.target.value)}
            rows={4}
            className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
            placeholder={
              localEngine === "kokoro"
                ? `Lucifer — The Devil => Lucifer\nKaelen => KaALean\nNaya => NaYa`
                : `Elias => Eh-LEE-as\nNaya => NAI-ya\nKethari => keh-THA-ree`
            }
          />
          <p className="mb-3 text-[11px] text-zinc-500">
            Format pro Zeile: <code className="text-zinc-400">Name =&gt; Aussprache</code>.
            {localEngine === "kokoro"
              ? " Kokoro: Kurzform + Großbuchstaben für Betonung (z. B. NaYa). Volle Charakterkartentitel als Quelle eintragen."
              : " Edge/ElevenLabs: Silbentrennung mit Bindestrich."}
          </p>
          <button
            type="button"
            onClick={saveTts}
            className="w-full rounded-lg bg-accent py-2 text-sm font-medium text-black"
          >
            Save TTS settings
          </button>
          {ttsSaved ? (
            <p className="mt-2 text-center text-xs text-green-400">Saved</p>
          ) : null}
            </section>

            <section className="rounded-xl border border-surface-border p-4 text-xs text-zinc-500">
              <p className="mb-2">
                Get a key at{" "}
                <a
                  href="https://openrouter.ai"
                  className="text-accent underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  openrouter.ai
                </a>
                . Recommended:{" "}
                <code className="text-zinc-400">anthropic/claude-sonnet-4</code>
              </p>
              <p>
                Local TTS guide:{" "}
                <code className="text-zinc-400">docs/LOCAL-TTS.md</code>
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

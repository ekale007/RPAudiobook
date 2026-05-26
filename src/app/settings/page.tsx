"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
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
} from "@/lib/storage/ttsSettings";
import { KokoroVoicePicker } from "@/components/KokoroVoicePicker";
import {
  LOCAL_TTS_PRESETS,
  type LocalTtsEngine,
} from "@/lib/storage/ttsPresets";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_OPENROUTER.model);
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
  const [ttsSaved, setTtsSaved] = useState(false);

  useEffect(() => {
    const s = loadOpenRouterSettings();
    if (s) {
      setApiKey(s.apiKey);
      setModel(s.model);
      setMaxTokens(s.maxTokens);
      setTemperature(s.temperature);
    }
    const tts = loadTtsSettings();
    setTtsProvider(tts.provider);
    setLocalEngine(tts.localEngine ?? "edge");
    setLocalUrl(tts.localServerUrl);
    setLocalVoice(tts.localVoice);
    setElApiKey(tts.elevenLabsApiKey);
    setElVoiceId(tts.elevenLabsVoiceId);
    setElModelId(tts.elevenLabsModelId);
  }, []);

  const save = () => {
    saveOpenRouterSettings({
      apiKey: apiKey.trim(),
      model,
      maxTokens,
      temperature,
    });
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

  const saveTts = () => {
    saveTtsSettings({
      provider: ttsProvider,
      localEngine,
      localServerUrl: localUrl.trim(),
      localVoice: localVoice.trim(),
      elevenLabsApiKey: elApiKey.trim(),
      elevenLabsVoiceId: elVoiceId.trim(),
      elevenLabsModelId: elModelId.trim(),
    });
    setTtsSaved(true);
    setTimeout(() => setTtsSaved(false), 2000);
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Settings" backHref="/" />
      <div className="flex flex-col gap-5 p-4">
        <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-1 font-medium text-accent">OpenRouter</h2>
          <p className="mb-3 text-xs text-zinc-500">
            Stored only in this browser (localStorage). Never sent to our
            server — only directly to OpenRouter when you chat.
          </p>
          <label className="mb-1 block text-xs text-zinc-400">API key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
            placeholder="sk-or-…"
            autoComplete="off"
          />
          <label className="mb-1 block text-xs text-zinc-400">Model</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
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
              <input
                type="number"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
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
            <strong>Local (free)</strong> uses a small server on your PC — no
            ElevenLabs account. See{" "}
            <code className="text-zinc-400">docs/LOCAL-TTS.md</code>.
          </p>
          <div className="mb-3 flex gap-2">
            {(["local", "elevenlabs"] as const).map((p) => (
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
                {p === "local" ? "Local (free)" : "ElevenLabs"}
              </button>
            ))}
          </div>
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
              <p className="mb-2 text-xs text-zinc-500">
                PC:{" "}
                <code className="text-accent">
                  {localEngine === "kokoro"
                    ? "npm run tts:kokoro"
                    : "npm run tts:server"}
                </code>{" "}
                + <code className="text-accent">npm run dev</code>
                {localEngine === "kokoro" ? (
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
              </p>
              <label className="mb-1 block text-xs text-zinc-400">
                Server URL
              </label>
              <input
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
              {localEngine === "kokoro" ? (
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
              <label className="mb-1 block text-xs text-zinc-400">
                Voice ID
              </label>
              <input
                value={elVoiceId}
                onChange={(e) => setElVoiceId(e.target.value)}
                className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-xs text-zinc-400">Model</label>
              <input
                value={elModelId}
                onChange={(e) => setElModelId(e.target.value)}
                className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              />
            </>
          )}
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
            Local TTS guide: <code className="text-zinc-400">docs/LOCAL-TTS.md</code>
          </p>
        </section>
      </div>
    </main>
  );
}

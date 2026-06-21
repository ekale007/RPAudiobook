import { useCallback, useEffect, useMemo, useState } from "react";
import {
  checkHealth,
  generateImage,
  loadSettings,
  optimizePrompt,
  saveSettings,
  type StudioSettings,
} from "./lib/api";
import {
  getPreset,
  IMAGE_FORMAT_PRESETS,
  withStylePrefix,
  type ImageFormatId,
} from "./lib/presets";

export function App() {
  const [formatId, setFormatId] = useState<ImageFormatId>("cover");
  const [brief, setBrief] = useState("");
  const [prompt, setPrompt] = useState("");
  const [seed, setSeed] = useState("");
  const [steps, setSteps] = useState<number | "">("");
  const [settings, setSettings] = useState<StudioSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [optimizeBusy, setOptimizeBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [serverHint, setServerHint] = useState<string | null>(null);

  const preset = getPreset(formatId);
  const effectiveSteps = steps === "" ? preset.steps : steps;
  const fullPrompt = useMemo(
    () => withStylePrefix(formatId, prompt),
    [formatId, prompt],
  );

  const refreshHealth = useCallback(async () => {
    const h = await checkHealth();
    setServerOk(h.ok);
    setServerHint(h.ok ? (h.engine ?? "sdxl-turbo") : (h.error ?? null));
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const persistSettings = (next: StudioSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const handleOptimize = async () => {
    const key = settings.openRouterKey.trim();
    if (!key) {
      setError("OpenRouter-Key in den Einstellungen eintragen.");
      setShowSettings(true);
      return;
    }
    setOptimizeBusy(true);
    setError(null);
    setMessage(null);
    try {
      const optimized = await optimizePrompt({
        brief,
        preset,
        currentPrompt: prompt,
        apiKey: key,
        model: settings.openRouterModel,
      });
      setPrompt(optimized);
      setMessage("Prompt optimiert.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOptimizeBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const blob = await generateImage({
        prompt: fullPrompt,
        width: preset.width,
        height: preset.height,
        steps: effectiveSteps,
        seed: seed.trim() ? Number(seed) : null,
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setMessage("Bild generiert.");
      await refreshHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await refreshHealth();
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `${formatId}-${preset.width}x${preset.height}.webp`;
    a.click();
  };

  const previewClass =
    formatId === "cover"
      ? "preview preview-cover"
      : formatId === "portrait" || formatId === "square" || formatId === "thumbnail"
        ? "preview preview-square"
        : "preview preview-wide";

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Image Studio</h1>
          <p className="subtitle">SDXL-Turbo auf deiner GPU · KI-Prompts · Standardformate</p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setShowSettings((v) => !v)}
        >
          Einstellungen
        </button>
      </header>

      {showSettings ? (
        <section className="card settings">
          <h2>OpenRouter (Prompt-Optimierung)</h2>
          <label>
            API-Key
            <input
              type="password"
              value={settings.openRouterKey}
              onChange={(e) =>
                persistSettings({ ...settings, openRouterKey: e.target.value })
              }
              placeholder="sk-or-…"
            />
          </label>
          <label>
            Modell
            <input
              value={settings.openRouterModel}
              onChange={(e) =>
                persistSettings({ ...settings, openRouterModel: e.target.value })
              }
              placeholder="google/gemini-2.5-flash-lite"
            />
          </label>
          <p className="hint">
            Alternativ <code>OPENROUTER_API_KEY</code> in <code>.env</code> —
            dann kann das Key-Feld leer bleiben.
          </p>
        </section>
      ) : null}

      <div
        className={`status ${serverOk ? "ok" : serverOk === false ? "warn" : ""}`}
      >
        {serverOk === null
          ? "GPU-Server wird geprüft …"
          : serverOk
            ? `GPU bereit (${serverHint}). Erstes Bild lädt das Modell (~30–90 s).`
            : (serverHint ??
              "GPU-Server offline — im Ordner image-studio: npm run dev")}
      </div>

      <section className="card">
        <h2>Format</h2>
        <div className="format-grid">
          {IMAGE_FORMAT_PRESETS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`format-btn ${formatId === f.id ? "active" : ""}`}
              onClick={() => setFormatId(f.id)}
            >
              <strong>{f.label}</strong>
              <span>
                {f.width}×{f.height} · {f.hint}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <label>
          Idee (Deutsch ok)
          <textarea
            rows={3}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="düstere Raumstation, rotes Notlicht, einsame Figur am Fenster …"
          />
        </label>
        <div className="row">
          <button
            type="button"
            className="btn-secondary"
            disabled={optimizeBusy || (!brief.trim() && !prompt.trim())}
            onClick={() => void handleOptimize()}
          >
            {optimizeBusy ? "KI optimiert …" : "KI-Prompt optimieren"}
          </button>
        </div>
        <label>
          Bild-Prompt (Englisch, SDXL)
          <textarea
            rows={6}
            className="mono"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Cinematic scene description …"
          />
        </label>
        <details className="advanced">
          <summary>Erweitert</summary>
          <p className="hint mono-block">{fullPrompt || "—"}</p>
          <div className="row">
            <label>
              Seed
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="zufällig"
              />
            </label>
            <label>
              Steps
              <input
                type="number"
                min={1}
                max={12}
                value={steps}
                onChange={(e) =>
                  setSteps(e.target.value ? Number(e.target.value) : "")
                }
                placeholder={String(preset.steps)}
              />
            </label>
          </div>
        </details>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !prompt.trim() || serverOk === false}
          onClick={() => void handleGenerate()}
        >
          {busy
            ? "Generiere auf GPU …"
            : `Generieren (${preset.width}×${preset.height})`}
        </button>
      </section>

      {previewUrl ? (
        <section className="card">
          <h2>Vorschau</h2>
          <img src={previewUrl} alt="Generiert" className={previewClass} />
          <button type="button" className="btn-secondary" onClick={download}>
            WebP herunterladen
          </button>
        </section>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AiField } from "@/components/story-editor/AiField";
import {
  DEFAULT_REMIX_ASPECTS,
  StoryTemplateSection,
} from "@/components/story-editor/StoryTemplateSection";
import { StoryDraftEditor } from "@/components/story-editor/StoryDraftEditor";
import { createClient } from "@/lib/supabase/client";
import {
  createStoryFromSeedPack,
  type CreateStoryFromPackOptions,
} from "@/lib/db/stories";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";
import {
  draftToSeedPack,
  generateStoryDraft,
  parseStoryDraftJson,
  type StoryDraft,
} from "@/lib/story/generateStoryDraft";
import {
  emptyStoryDraft,
  generateCharactersOnly,
  generateStoryMetaOnly,
  generateWorldLorebookOnly,
  mergeDraftMeta,
  randomizeConceptField,
  remixTemplateAspects,
  TEMPLATE_REMIX_LABELS,
  type EditorBrief,
  type TemplateRemixAspect,
} from "@/lib/story/storyFieldAi";
import {
  cloneStoryDraft,
  loadTemplateDraft,
  type StoryTemplateId,
} from "@/lib/story/storyTemplates";

type StepKey =
  | "meta"
  | "lore"
  | "characters"
  | "full"
  | "concept"
  | "genre"
  | "tone"
  | "remix";

export default function NewStoryEditorPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [concept, setConcept] = useState("");
  const [locale, setLocale] = useState<"de" | "en">("de");
  const [genre, setGenre] = useState("");
  const [tone, setTone] = useState("");
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [rawJson, setRawJson] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [busyStep, setBusyStep] = useState<StepKey | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<StoryTemplateId>("none");
  const [templateBase, setTemplateBase] = useState<StoryDraft | null>(null);
  const [templateLabel, setTemplateLabel] = useState<string | null>(null);
  const [remixAspects, setRemixAspects] = useState(DEFAULT_REMIX_ASPECTS);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        setUserId(data.user.id);
      });
  }, [router]);

  const brief: EditorBrief = {
    concept,
    locale,
    genre: genre || undefined,
    tone: tone || undefined,
    draft,
    templateBase,
    templateLabel: templateLabel ?? undefined,
  };

  const requireSettings = (): ReturnType<typeof loadOpenRouterSettings> => {
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setError("OpenRouter API-Key fehlt — bitte unter Einstellungen hinterlegen.");
      return null;
    }
    return settings;
  };

  const requireConcept = (): boolean => {
    if (!concept.trim()) {
      setError("Bitte zuerst eine Kurzbeschreibung / Idee eingeben.");
      return false;
    }
    return true;
  };

  const ensureDraft = (): StoryDraft => {
    if (draft) return draft;
    const shell = emptyStoryDraft(locale);
    setDraft(shell);
    return shell;
  };

  const syncRawFromDraft = (d: StoryDraft) => {
    setRawJson(JSON.stringify(d, null, 2));
  };

  const randomizeConcept = async (field: "concept" | "genre" | "tone") => {
    const settings = requireSettings();
    if (!settings) return;
    setBusyStep(field);
    setError(null);
    try {
      const current =
        field === "concept" ? concept : field === "genre" ? genre : tone;
      const value = await randomizeConceptField(
        settings,
        { concept, locale, genre, tone, field },
        current,
      );
      if (field === "concept") setConcept(value);
      else if (field === "genre") setGenre(value);
      else setTone(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyStep(null);
    }
  };

  const runStep = async (step: StepKey) => {
    if (step !== "full" && !requireConcept()) return;
    const settings = requireSettings();
    if (!settings) return;

    setBusyStep(step);
    setError(null);
    setMessage(null);

    try {
      const input = {
        concept,
        locale,
        genre: genre || undefined,
        tone: tone || undefined,
      };

      if (step === "full") {
        const result = await generateStoryDraft(settings, input);
        setDraft(result);
        syncRawFromDraft(result);
        setMessage("Komplett-Entwurf erstellt — Felder einzeln mit 🎲 verfeinern.");
        return;
      }

      const base = ensureDraft();
      const ctx: EditorBrief = { ...brief, draft: base };

      if (step === "meta") {
        const meta = await generateStoryMetaOnly(settings, ctx);
        const merged = mergeDraftMeta(base, meta);
        setDraft(merged);
        syncRawFromDraft(merged);
        setMessage("Meta-Titel generiert.");
      } else if (step === "lore") {
        const worldLorebook = await generateWorldLorebookOnly(settings, ctx);
        const merged = { ...base, worldLorebook };
        setDraft(merged);
        syncRawFromDraft(merged);
        setMessage("Lorebook generiert — pro Eintrag 🎲 nutzen.");
      } else if (step === "characters") {
        const characters = await generateCharactersOnly(settings, ctx);
        const merged = { ...base, characters };
        setDraft(merged);
        syncRawFromDraft(merged);
        setMessage("Figuren generiert — Karten pro Feld mit 🎲 anpassen.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyStep(null);
    }
  };

  const handleLoadTemplate = (payload: {
    draft: StoryDraft;
    templateBase: StoryDraft;
    templateLabel: string;
    locale: "de" | "en";
    concept: string;
    genre: string;
    tone: string;
  }) => {
    setDraft(payload.draft);
    setTemplateBase(payload.templateBase);
    setTemplateLabel(payload.templateLabel);
    setLocale(payload.locale);
    setConcept(payload.concept);
    setGenre(payload.genre);
    setTone(payload.tone);
    syncRawFromDraft(payload.draft);
    setRemixAspects({ ...DEFAULT_REMIX_ASPECTS });
    setMessage(`Vorlage „${payload.templateLabel}“ geladen — Anpassungen wählen.`);
    setError(null);
  };

  const handleResetTemplate = () => {
    if (templateId === "none") return;
    const loaded = loadTemplateDraft(templateId);
    if (!loaded) return;
    const { draft: d, template } = loaded;
    const base = cloneStoryDraft(d);
    setDraft(d);
    setTemplateBase(base);
    setTemplateLabel(template.label);
    syncRawFromDraft(d);
    setMessage("Vorlage zurückgesetzt.");
  };

  const handleRemixSelected = async () => {
    if (!templateBase || !draft) {
      setError("Zuerst eine Vorlage wählen.");
      return;
    }
    const aspects = (Object.keys(remixAspects) as TemplateRemixAspect[]).filter(
      (k) => remixAspects[k],
    );
    if (!aspects.length) {
      setError("Mindestens einen Bereich zum Anpassen auswählen.");
      return;
    }
    if (!concept.trim()) {
      setError(
        "Bitte Konzept anpassen (was soll anders sein als die Vorlage?).",
      );
      return;
    }
    const settings = requireSettings();
    if (!settings) return;

    setBusyStep("remix");
    setError(null);
    try {
      const { draft: next, tone: newTone } = await remixTemplateAspects(
        settings,
        brief,
        aspects,
      );
      setDraft(next);
      if (newTone) setTone(newTone);
      syncRawFromDraft(next);
      setMessage(
        `Angepasst: ${aspects.map((a) => TEMPLATE_REMIX_LABELS[a]).join(", ")}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyStep(null);
    }
  };

  const applyRawJson = () => {
    try {
      const parsed = parseStoryDraftJson(rawJson, locale);
      setDraft(parsed);
      setError(null);
      setMessage("JSON übernommen.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCreate = async () => {
    if (!userId || !draft) return;
    if (!draft.storyTitle.trim()) {
      setError("Story-Titel fehlt.");
      return;
    }
    const narrators = draft.characters.filter((c) => c.role === "narrator");
    if (narrators.length !== 1) {
      setError("Genau ein Narrator ist nötig (Schritt „Figuren“ oder Komplett-Entwurf).");
      return;
    }
    if (!draft.worldLorebook.entries.length) {
      setError("Mindestens ein Lore-Eintrag nötig.");
      return;
    }

    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const pack = draftToSeedPack(draft);
      const opts: CreateStoryFromPackOptions = {
        userId,
        pack,
        title: draft.storyTitle,
        locale: draft.locale,
        bandTitle: draft.bandTitle || "Band I",
        chapterTitle: draft.chapterTitle || "Kapitel 1",
        phaseHint: draft.phaseHint ?? null,
        storyOrigin: "editor",
        libraryTemplateId: templateId !== "none" ? templateId : null,
        storyConcept: concept.trim() || null,
      };
      const { storyId } = await createStoryFromSeedPack(opts);
      router.push(`/story/${storyId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  };

  const castCount =
    draft?.characters.filter((c) => c.role === "cast").length ?? 0;
  const stepBusy = busyStep !== null;

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Story-Editor" backHref="/" />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 pb-10">
        <p className="text-sm text-zinc-400">
          Schrittweise per KI bauen oder alles auf einmal — jedes Feld hat einen
          🎲-Randomizer für einen neuen Vorschlag.
        </p>

        <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-3 text-sm font-medium text-accent">1. Idee</h2>

          <StoryTemplateSection
            templateId={templateId}
            onTemplateIdChange={(id) => {
              setTemplateId(id);
              if (id === "none") {
                setTemplateBase(null);
                setTemplateLabel(null);
              }
            }}
            remixAspects={remixAspects}
            onRemixAspectsChange={setRemixAspects}
            templateLabel={templateLabel}
            onLoadTemplate={handleLoadTemplate}
            onResetTemplate={handleResetTemplate}
            onRemixSelected={handleRemixSelected}
            busy={busyStep === "remix"}
            disabled={stepBusy && busyStep !== "remix"}
          />

          <div className="mb-3 flex flex-col gap-3">
            <AiField
              label="Konzept"
              value={concept}
              onChange={setConcept}
              multiline
              rows={5}
              placeholder="Setting, Protagonist, Konflikt, Stimmung …"
              busy={busyStep === "concept"}
              onRandomize={() => randomizeConcept("concept")}
            />
            <div className="grid grid-cols-2 gap-3">
              <AiField
                label="Genre"
                value={genre}
                onChange={setGenre}
                placeholder="Sci-Fi, Romance …"
                busy={busyStep === "genre"}
                onRandomize={() => randomizeConcept("genre")}
              />
              <label className="block text-xs text-zinc-400">
                Sprache
                <select
                  value={locale}
                  onChange={(e) =>
                    setLocale(e.target.value as "de" | "en")
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm"
                >
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
            <AiField
              label="Ton"
              value={tone}
              onChange={setTone}
              placeholder="düster, humorvoll …"
              busy={busyStep === "tone"}
              onRandomize={() => randomizeConcept("tone")}
            />
          </div>

          <p className="mb-2 text-xs text-zinc-500">KI-Schritte (einzeln)</p>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={stepBusy}
              onClick={() => runStep("meta")}
              className="rounded-lg border border-zinc-700 py-2 text-xs text-zinc-200 disabled:opacity-50"
            >
              {busyStep === "meta" ? "…" : "① Meta-Titel"}
            </button>
            <button
              type="button"
              disabled={stepBusy}
              onClick={() => runStep("lore")}
              className="rounded-lg border border-zinc-700 py-2 text-xs text-zinc-200 disabled:opacity-50"
            >
              {busyStep === "lore" ? "…" : "② Lorebook"}
            </button>
            <button
              type="button"
              disabled={stepBusy}
              onClick={() => runStep("characters")}
              className="rounded-lg border border-zinc-700 py-2 text-xs text-zinc-200 disabled:opacity-50"
            >
              {busyStep === "characters" ? "…" : "③ Figuren"}
            </button>
            <button
              type="button"
              disabled={stepBusy}
              onClick={() => runStep("full")}
              className="rounded-lg bg-accent py-2 text-xs font-medium text-black disabled:opacity-50"
            >
              {busyStep === "full" ? "…" : "Alles entwerfen"}
            </button>
          </div>
          <button
            type="button"
            disabled={stepBusy}
            onClick={() => {
              setDraft(emptyStoryDraft(locale));
              setMessage("Leerer Entwurf — Felder manuell oder mit 🎲 füllen.");
            }}
            className="w-full rounded-lg border border-dashed border-zinc-700 py-2 text-xs text-zinc-500"
          >
            Leeren Entwurf starten (ohne KI)
          </button>
          <Link
            href="/settings"
            className="mt-2 block text-center text-xs text-zinc-500 underline"
          >
            OpenRouter-Einstellungen
          </Link>
        </section>

        {draft ? (
          <section className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <h2 className="mb-1 text-sm font-medium text-accent">
              2. Entwurf bearbeiten
            </h2>
            <p className="mb-4 text-xs text-zinc-400">
              {draft.characters.length} Figuren ({castCount} Cast) ·{" "}
              {draft.worldLorebook.entries.length} Lore-Einträge · 🎲 pro Feld
            </p>

            <StoryDraftEditor
              draft={draft}
              onChange={(d) => {
                setDraft(d);
                if (showRaw) syncRawFromDraft(d);
              }}
              brief={brief}
              onError={setError}
            />

            <button
              type="button"
              onClick={() => {
                setShowRaw((v) => !v);
                if (!showRaw) syncRawFromDraft(draft);
              }}
              className="mt-4 text-xs text-accent underline"
            >
              {showRaw ? "JSON ausblenden" : "JSON (fortgeschritten)"}
            </button>
            {showRaw ? (
              <div className="mt-2">
                <textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 font-mono text-xs text-zinc-300"
                />
                <button
                  type="button"
                  onClick={applyRawJson}
                  className="mt-2 rounded-lg border border-zinc-600 px-3 py-1 text-xs text-zinc-300"
                >
                  JSON übernehmen
                </button>
              </div>
            ) : null}

            <button
              type="button"
              disabled={creating}
              onClick={handleCreate}
              className="mt-4 w-full rounded-xl border border-accent/50 bg-accent/20 py-3 text-sm font-medium text-accent disabled:opacity-50"
            >
              {creating ? "Speichern …" : "Story erstellen & öffnen"}
            </button>
          </section>
        ) : null}

        <section className="rounded-xl border border-surface-border p-4 text-center">
          <p className="mb-2 text-xs text-zinc-500">
            Oder aus der Bibliothek importieren
          </p>
          <Link href="/" className="text-sm text-accent underline">
            Zur Startseite → When Dawn Breaks &amp; mehr
          </Link>
        </section>

        {message ? (
          <p className="text-center text-sm text-emerald-400/90">{message}</p>
        ) : null}
        {error ? (
          <p className="text-center text-sm text-red-400">{error}</p>
        ) : null}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { GeneratingIndicator } from "@/components/GeneratingIndicator";
import { StoryDraftEditor } from "@/components/story-editor/StoryDraftEditor";
import { createClient } from "@/lib/supabase/client";
import {
  createStoryFromSeedPack,
  type CreateStoryFromPackOptions,
} from "@/lib/db/stories";
import {
  buildEpubExcerpt,
  guessEpubLocale,
  parseEpubFile,
  type ParsedEpub,
} from "@/lib/import/epubParse";
import {
  generateStoryDraftFromEpub,
  type EpubAdaptationMode,
  type EpubImportInterview,
} from "@/lib/import/epubToDraft";
import {
  draftToSeedPack,
  type StoryDraft,
} from "@/lib/story/generateStoryDraft";
import type { EditorBrief } from "@/lib/story/storyFieldAi";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";

type Step = "upload" | "interview" | "generating" | "review";

const ADAPTATION_OPTIONS: Array<{
  id: EpubAdaptationMode;
  label: string;
  hint: string;
}> = [
  {
    id: "faithful",
    label: "Treu am Buch",
    hint: "Gleiche Welt, Figuren und Plot — als interaktives Du-Hörbuch",
  },
  {
    id: "inspired",
    label: "Inspiriert",
    hint: "Starker Bezug, etwas Spielraum für Abzweigungen",
  },
  {
    id: "loose",
    label: "Lose Remix",
    hint: "Premisse und Stimmung behalten, viel Freiheit",
  },
];

export default function EpubImportPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedEpub | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [parseBusy, setParseBusy] = useState(false);

  const [locale, setLocale] = useState<"de" | "en">("de");
  const [protagonistName, setProtagonistName] = useState("");
  const [protagonistDescription, setProtagonistDescription] = useState("");
  const [adaptation, setAdaptation] = useState<EpubAdaptationMode>("inspired");
  const [startChapterIndex, setStartChapterIndex] = useState(0);
  const [tone, setTone] = useState("");
  const [castNotes, setCastNotes] = useState("");
  const [extraNotes, setExtraNotes] = useState("");

  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [genStatus, setGenStatus] = useState("Story wird aus dem Buch entworfen …");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  const brief: EditorBrief = useMemo(
    () => ({
      concept: parsed
        ? `EPUB-Import: ${parsed.title}${parsed.creator ? ` von ${parsed.creator}` : ""}`
        : "",
      locale,
      draft,
    }),
    [parsed, locale, draft],
  );

  const excerptPreview = useMemo(() => {
    if (!parsed) return "";
    return buildEpubExcerpt(parsed, {
      startChapterIndex,
      maxChars: 600,
    });
  }, [parsed, startChapterIndex]);

  const onFileSelected = async (file: File | null) => {
    if (!file) return;
    if (!rightsConfirmed) {
      setError("Bitte zuerst die Rechte-Bestätigung ankreuzen.");
      return;
    }
    setParseBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await parseEpubFile(file);
      setParsed(result);
      setLocale(guessEpubLocale(result));
      setStartChapterIndex(0);
      setTone("");
      setCastNotes("");
      setProtagonistName("");
      setProtagonistDescription("");
      setDraft(null);
      setStep("interview");
      setMessage(
        `${result.chapters.length} Kapitel erkannt · ${Math.round(result.totalChars / 1000)}k Zeichen`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setParseBusy(false);
    }
  };

  const runGenerate = async () => {
    if (!parsed) return;
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setError("OpenRouter API-Key fehlt — bitte unter Einstellungen hinterlegen.");
      return;
    }

    const interview: EpubImportInterview = {
      locale,
      protagonistName,
      protagonistDescription,
      adaptation,
      startChapterIndex,
      tone,
      castNotes,
      extraNotes: extraNotes.trim() || undefined,
    };

    setStep("generating");
    setGenStatus("Welt, Figuren und Eröffnung werden entworfen …");
    setError(null);
    setMessage(null);

    try {
      const result = await generateStoryDraftFromEpub(
        settings,
        parsed,
        interview,
      );
      setDraft(result);
      setStep("review");
      setMessage("Entwurf fertig — Felder prüfen und Story anlegen.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("interview");
    }
  };

  const handleCreate = async () => {
    if (!userId || !draft || !parsed) return;
    if (!draft.storyTitle.trim()) {
      setError("Story-Titel fehlt.");
      return;
    }
    const narrators = draft.characters.filter((c) => c.role === "narrator");
    if (narrators.length !== 1) {
      setError("Genau ein Narrator ist nötig.");
      return;
    }
    if (!draft.worldLorebook.entries.length) {
      setError("Mindestens ein Lore-Eintrag nötig.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const pack = draftToSeedPack(draft);
      const concept = [
        `Adaptiert aus EPUB „${parsed.title}"`,
        parsed.creator ? `(${parsed.creator})` : null,
        `Modus: ${adaptation}`,
        protagonistName.trim() ? `Protagonist: ${protagonistName.trim()}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const opts: CreateStoryFromPackOptions = {
        userId,
        pack,
        title: draft.storyTitle,
        locale: draft.locale,
        bandTitle: draft.bandTitle || "Band I",
        chapterTitle: draft.chapterTitle || "Kapitel 1",
        phaseHint: draft.phaseHint ?? null,
        storyOrigin: "epub",
        storyConcept: concept,
      };
      const { storyId } = await createStoryFromSeedPack(opts);
      router.push(`/story/${storyId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="EPUB-Import" backHref="/" />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 pb-10">
        <p className="text-sm text-zinc-400">
          DRM-freie EPUBs werden nur auf diesem Gerät verarbeitet und gespeichert
          (IndexedDB) — kein Buchtext auf dem Server. Danach kurzes Interview und
          KI-Entwurf wie bei Story erstellen.
        </p>

        {step === "upload" ? (
          <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h2 className="mb-3 text-sm font-medium text-accent">
              1. EPUB wählen
            </h2>
            <label className="mb-4 flex cursor-pointer items-start gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span>
                Ich bestätige, dass ich die Rechte habe, dieses Buch für einen
                privaten interaktiven Entwurf zu nutzen (eigenes Werk, CC, oder
                ausdrücklich erlaubt).
              </span>
            </label>
            <label
              className={`flex flex-col items-center gap-3 rounded-xl border border-dashed border-surface-border bg-surface px-4 py-8 ${
                rightsConfirmed && !parseBusy
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-60"
              }`}
            >
              <span className="text-sm text-zinc-300">
                {parseBusy ? "EPUB wird gelesen …" : ".epub-Datei auswählen"}
              </span>
              <span className="text-xs text-zinc-500">Max. 20 MB · ohne DRM</span>
              <input
                type="file"
                accept=".epub,application/epub+zip"
                disabled={parseBusy || !rightsConfirmed}
                className="sr-only"
                onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
              />
              <span className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-black">
                Datei wählen
              </span>
            </label>
            {!rightsConfirmed ? (
              <p className="mt-2 text-[10px] text-zinc-600">
                Checkbox ankreuzen, dann Datei wählen.
              </p>
            ) : null}
          </section>
        ) : null}

        {step === "interview" && parsed ? (
          <section className="flex flex-col gap-4 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div>
              <h2 className="text-sm font-medium text-accent">2. Buch &amp; Interview</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {parsed.title}
                {parsed.creator ? ` · ${parsed.creator}` : ""} ·{" "}
                {parsed.chapters.length} Kapitel
              </p>
            </div>

            {parsed.coverDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={parsed.coverDataUrl}
                alt=""
                className="mx-auto h-40 w-auto rounded-lg border border-surface-border object-contain shadow"
              />
            ) : null}

            <label className="text-xs text-zinc-500">
              Sprache der Story
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as "de" | "en")}
                className="mt-1 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-base"
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>

            <label className="text-xs text-zinc-500">
              Einstieg (Kapitel)
              <select
                value={startChapterIndex}
                onChange={(e) =>
                  setStartChapterIndex(Number.parseInt(e.target.value, 10))
                }
                className="mt-1 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-base"
              >
                {parsed.chapters.map((ch) => (
                  <option key={ch.index} value={ch.index}>
                    {ch.title} ({Math.round(ch.charCount / 1000)}k Zeichen)
                  </option>
                ))}
              </select>
            </label>

            {excerptPreview ? (
              <p className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-[11px] italic leading-relaxed text-zinc-600">
                {`„${excerptPreview.slice(0, 280)}${excerptPreview.length > 280 ? "…" : ""}"`}
              </p>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-medium text-zinc-400">
                Adaptation
              </legend>
              {ADAPTATION_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer gap-2 rounded-lg border px-3 py-2 ${
                    adaptation === opt.id
                      ? "border-accent/50 bg-accent/10"
                      : "border-transparent"
                  }`}
                >
                  <input
                    type="radio"
                    name="adaptation"
                    checked={adaptation === opt.id}
                    onChange={() => setAdaptation(opt.id)}
                    className="mt-1 accent-accent"
                  />
                  <span>
                    <span className="block text-sm text-zinc-200">{opt.label}</span>
                    <span className="block text-xs text-zinc-500">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <label className="text-xs text-zinc-500">
              Dein Name / Rolle (Protagonist)
              <input
                value={protagonistName}
                onChange={(e) => setProtagonistName(e.target.value)}
                placeholder="z. B. Alex — oder leer lassen, KI leitet aus dem Buch ab"
                className="mt-1 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-base"
              />
            </label>

            <label className="text-xs text-zinc-500">
              Protagonist &amp; Perspektive (optional)
              <textarea
                value={protagonistDescription}
                onChange={(e) => setProtagonistDescription(e.target.value)}
                rows={2}
                placeholder="Wen spielst du, was willst du erleben?"
                className="mt-1 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-base"
              />
            </label>

            <label className="text-xs text-zinc-500">
              Ton / Stimmung
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="z. B. düster, hoffnungsvoll, schnell …"
                className="mt-1 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-base"
              />
            </label>

            <label className="text-xs text-zinc-500">
              Wichtige Figuren mit Stimme (optional)
              <textarea
                value={castNotes}
                onChange={(e) => setCastNotes(e.target.value)}
                rows={2}
                placeholder="z. B. Mentor, Antagonist, beste Freundin …"
                className="mt-1 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-base"
              />
            </label>

            <label className="text-xs text-zinc-500">
              Sonstiges (optional)
              <textarea
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-base"
              />
            </label>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void runGenerate()}
                className="rounded-xl bg-accent py-3 text-sm font-medium text-black"
              >
                Story-Entwurf generieren
              </button>
              <button
                type="button"
                onClick={() => {
                  setParsed(null);
                  setStep("upload");
                  setMessage(null);
                }}
                className="text-center text-xs text-zinc-500 underline"
              >
                Andere EPUB wählen
              </button>
            </div>
          </section>
        ) : null}

        {step === "generating" ? (
          <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <GeneratingIndicator label={genStatus} />
            <p className="mt-3 text-xs text-zinc-500">
              Das kann 30–90 Sekunden dauern (ein großer KI-Aufruf).
            </p>
          </section>
        ) : null}

        {step === "review" && draft ? (
          <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h2 className="mb-3 text-sm font-medium text-accent">
              3. Entwurf prüfen
            </h2>
            <StoryDraftEditor
              draft={draft}
              onChange={setDraft}
              brief={brief}
              onError={setError}
            />
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="mt-4 w-full rounded-xl border border-accent/50 bg-accent/20 py-3 text-sm font-medium text-accent disabled:opacity-50"
            >
              {creating ? "Speichern …" : "Story erstellen & öffnen"}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => setStep("interview")}
              className="mt-2 w-full text-center text-xs text-zinc-500 underline"
            >
              Zurück zum Interview
            </button>
          </section>
        ) : null}

        <section className="rounded-xl border border-surface-border p-4 text-center">
          <p className="mb-2 text-xs text-zinc-500">Oder ohne Buch starten</p>
          <Link href="/story/new" className="text-sm text-accent underline">
            Story-Editor → neue Idee
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

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { updateStorySettings } from "@/lib/db/stories";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { ui } from "@/lib/ui/classes";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";
import { randomizeConceptField } from "@/lib/story/storyFieldAi";

type MetaField = "concept" | "genre" | "tone";

function EditLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={`${ui.card} flex items-center gap-2 px-2.5 py-2 active:scale-[0.99]`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-zinc-200">{title}</p>
        <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
          {description}
        </p>
      </div>
      <span className="shrink-0 text-base text-zinc-600" aria-hidden>
        ›
      </span>
    </Link>
  );
}

function AiMetaField({
  label,
  value,
  placeholder,
  onChange,
  busy,
  onRandomize,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  busy: boolean;
  onRandomize: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-[10px] text-zinc-500">{label}</label>
        <button
          type="button"
          disabled={busy}
          onClick={onRandomize}
          title="KI-Vorschlag für dieses Feld"
          className="shrink-0 rounded-md border border-violet-800/60 bg-violet-950/40 px-2 py-0.5 text-[10px] font-medium text-violet-200 disabled:opacity-40"
        >
          {busy ? "…" : "🎲 KI"}
        </button>
      </div>
      {label === "Konzept" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className={`${ui.input} mb-2 resize-y text-xs`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${ui.input} mb-2 text-xs`}
        />
      )}
    </div>
  );
}

export function StoryHubEditSection({
  storyId,
  storyConcept,
  storyGenre,
  storyTone,
  storyLocale,
  onConceptSaved,
}: {
  storyId: string;
  storyConcept: string | null;
  storyGenre?: string | null;
  storyTone?: string | null;
  storyLocale?: "de" | "en";
  onConceptSaved?: () => void;
}) {
  const { t } = useUiLocale();
  const [concept, setConcept] = useState(storyConcept ?? "");
  const [genre, setGenre] = useState(storyGenre ?? "");
  const [tone, setTone] = useState(storyTone ?? "");
  const [busy, setBusy] = useState(false);
  const [busyField, setBusyField] = useState<MetaField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConcept(storyConcept ?? "");
    setGenre(storyGenre ?? "");
    setTone(storyTone ?? "");
    setSaved(false);
  }, [storyConcept, storyGenre, storyTone]);

  const dirty =
    concept.trim() !== (storyConcept ?? "").trim() ||
    genre.trim() !== (storyGenre ?? "").trim() ||
    tone.trim() !== (storyTone ?? "").trim();

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateStorySettings(storyId, {
        storyConcept: concept.trim() || null,
        storyGenre: genre.trim() || null,
        storyTone: tone.trim() || null,
      });
      setSaved(true);
      onConceptSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const randomize = async (field: MetaField) => {
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setError("Kein LLM-Setup gefunden — bitte in den Einstellungen prüfen.");
      return;
    }
    setBusyField(field);
    setError(null);
    try {
      const current =
        field === "concept" ? concept : field === "genre" ? genre : tone;
      const value = await randomizeConceptField(
        settings,
        {
          concept,
          locale: storyLocale ?? "de",
          genre: genre || undefined,
          tone: tone || undefined,
          field,
        },
        current,
      );
      if (field === "concept") setConcept(value);
      else if (field === "genre") setGenre(value);
      else setTone(value);
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyField(null);
    }
  };

  return (
    <section className={`${ui.panel} p-2.5`}>
      <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {t("storyHub.editTitle")}
      </h2>

      <AiMetaField
        label="Konzept"
        value={concept}
        placeholder={t("storyHub.conceptPlaceholder")}
        onChange={setConcept}
        busy={busyField === "concept"}
        onRandomize={() => void randomize("concept")}
      />
      <div className="grid grid-cols-2 gap-2">
        <AiMetaField
          label="Genre"
          value={genre}
          placeholder="z. B. Space Opera, Urban Fantasy"
          onChange={setGenre}
          busy={busyField === "genre"}
          onRandomize={() => void randomize("genre")}
        />
        <AiMetaField
          label="Ton"
          value={tone}
          placeholder="z. B. düster, poetisch"
          onChange={setTone}
          busy={busyField === "tone"}
          onRandomize={() => void randomize("tone")}
        />
      </div>

      <div className="mb-2.5 flex items-center gap-2">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => void save()}
          className={ui.btnPrimary}
        >
          {busy ? t("common.saving") : t("storyHub.conceptSave")}
        </button>
        {saved && !dirty ? (
          <span className="text-[10px] text-green-400/90">{t("common.saved")}</span>
        ) : null}
        {error ? (
          <span className="text-[10px] text-red-400">{error}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <EditLink
          href={`/story/${storyId}/cards`}
          title={t("storyHub.cardsTitle")}
          description={t("storyHub.cardsDesc")}
        />
        <EditLink
          href={`/story/${storyId}/world`}
          title={t("storyHub.worldTitle")}
          description={t("storyHub.worldDesc")}
        />
        <EditLink
          href={`/story/${storyId}/cast`}
          title="Figuren & Erinnerungen"
          description="Cast-Karten mit ❖ KI-Unterstützung bearbeiten"
        />
        <EditLink
          href={`/story/${storyId}/voices`}
          title={t("storyHub.voicesTitle")}
          description={t("storyHub.voicesDesc")}
        />
        <EditLink
          href={`/story/${storyId}/memory`}
          title={t("storyHub.memoryTitle")}
          description={t("storyHub.memoryDesc")}
        />
        <EditLink
          href={`/story/${storyId}/timeline`}
          title={t("storyHub.timelineTitle")}
          description={t("storyHub.timelineDesc")}
        />
      </div>
    </section>
  );
}
"use client";

import {
  DEFAULT_REMIX_ASPECTS,
  TEMPLATE_REMIX_LABELS,
  type TemplateRemixAspect,
} from "@/lib/story/storyFieldAi";
import {
  STORY_TEMPLATES,
  cloneStoryDraft,
  loadTemplateDraft,
  type StoryTemplateId,
} from "@/lib/story/storyTemplates";
import type { StoryDraft } from "@/lib/story/generateStoryDraft";

export interface StoryTemplateSectionProps {
  templateId: StoryTemplateId;
  onTemplateIdChange: (id: StoryTemplateId) => void;
  remixAspects: Record<TemplateRemixAspect, boolean>;
  onRemixAspectsChange: (next: Record<TemplateRemixAspect, boolean>) => void;
  templateLabel: string | null;
  onLoadTemplate: (payload: {
    draft: StoryDraft;
    templateBase: StoryDraft;
    templateLabel: string;
    locale: "de" | "en";
    concept: string;
    genre: string;
    tone: string;
  }) => void;
  onResetTemplate: () => void;
  onRemixSelected: () => void;
  busy: boolean;
  disabled?: boolean;
}

export function StoryTemplateSection({
  templateId,
  onTemplateIdChange,
  remixAspects,
  onRemixAspectsChange,
  templateLabel,
  onLoadTemplate,
  onResetTemplate,
  onRemixSelected,
  busy,
  disabled = false,
}: StoryTemplateSectionProps) {
  const hasTemplate = templateId !== "none";

  const applyTemplate = (id: StoryTemplateId) => {
    onTemplateIdChange(id);
    if (id === "none") return;
    const loaded = loadTemplateDraft(id);
    if (!loaded) return;
    const { draft, template } = loaded;
    const templateBase = cloneStoryDraft(draft);
    onLoadTemplate({
      draft,
      templateBase,
      templateLabel: template.label,
      locale: template.locale,
      concept: template.defaultConcept,
      genre: template.defaultGenre,
      tone: template.defaultTone,
    });
  };

  const toggleAspect = (key: TemplateRemixAspect) => {
    onRemixAspectsChange({ ...remixAspects, [key]: !remixAspects[key] });
  };

  const selectedCount = (
    Object.keys(remixAspects) as TemplateRemixAspect[]
  ).filter((k) => remixAspects[k]).length;

  return (
    <section className="mb-4 rounded-xl border border-violet-900/40 bg-violet-950/20 p-4">
      <h2 className="mb-3 text-sm font-medium text-violet-200">
        Auf Grundlage von
      </h2>
      <label className="mb-3 block text-xs text-zinc-400">
        Vorlage
        <select
          value={templateId}
          disabled={disabled || busy}
          onChange={(e) => applyTemplate(e.target.value as StoryTemplateId)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
        >
          {STORY_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {hasTemplate ? (
        <>
          <p className="mb-3 text-xs text-zinc-500">
            Vorlage <span className="text-violet-200">{templateLabel}</span>{" "}
            geladen. Wähle, was die KI an deinem Konzept ausrichten soll — der Rest
            bleibt aus der Vorlage.
          </p>
          <div className="mb-3 flex flex-col gap-2">
            {(Object.keys(TEMPLATE_REMIX_LABELS) as TemplateRemixAspect[]).map(
              (key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={remixAspects[key]}
                    disabled={disabled || busy}
                    onChange={() => toggleAspect(key)}
                    className="rounded border-zinc-600"
                  />
                  {TEMPLATE_REMIX_LABELS[key]}
                </label>
              ),
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={onResetTemplate}
              className="flex-1 rounded-lg border border-zinc-700 py-2 text-xs text-zinc-300 disabled:opacity-50"
            >
              Vorlage zurücksetzen
            </button>
            <button
              type="button"
              disabled={disabled || busy || selectedCount === 0}
              onClick={onRemixSelected}
              className="flex-1 rounded-lg border border-violet-600/60 bg-violet-900/40 py-2 text-xs font-medium text-violet-100 disabled:opacity-50"
            >
              {busy
                ? "KI passt an …"
                : `Ausgewähltes mit KI anpassen (${selectedCount})`}
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-zinc-600">
          Wähle eine Bibliotheks-Vorlage, passe Konzept & Ton an, und lasse nur
          Intro oder Charaktere neu schreiben.
        </p>
      )}
    </section>
  );
}

export { DEFAULT_REMIX_ASPECTS };

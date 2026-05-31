"use client";

import { useCallback, useState } from "react";
import { AiField } from "@/components/story-editor/AiField";
import type { StoryDraft } from "@/lib/story/generateStoryDraft";
import type { EditorBrief } from "@/lib/story/storyFieldAi";
import {
  fieldPathKey,
  getFieldValue,
  randomizeStoryField,
  setFieldValue,
  type CharacterCardField,
  type StoryFieldPath,
} from "@/lib/story/storyFieldAi";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";

const CARD_FIELDS: CharacterCardField[] = [
  "name",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "system_prompt",
  "post_history_instructions",
  "creator_notes",
  "mes_example",
];

const CARD_LABELS: Record<CharacterCardField, string> = {
  name: "Name",
  description: "Beschreibung",
  personality: "Persönlichkeit",
  scenario: "Szenario",
  first_mes: "Eröffnung (first_mes)",
  system_prompt: "System-Prompt",
  post_history_instructions: "Post-History",
  creator_notes: "Autor-Notizen",
  mes_example: "Beispiel-Dialog",
};

export interface StoryDraftEditorProps {
  draft: StoryDraft;
  onChange: (draft: StoryDraft) => void;
  brief: EditorBrief;
  onError: (msg: string | null) => void;
}

export function StoryDraftEditor({
  draft,
  onChange,
  brief,
  onError,
}: StoryDraftEditorProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const runField = useCallback(
    async (path: StoryFieldPath) => {
      const settings = loadOpenRouterSettings();
      if (!settings) {
        onError("OpenRouter API-Key fehlt — Einstellungen.");
        return;
      }
      const key = fieldPathKey(path);
      setBusyKey(key);
      onError(null);
      try {
        const value = await randomizeStoryField(settings, { ...brief, draft }, path);
        onChange(setFieldValue(draft, path, value));
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyKey(null);
      }
    },
    [brief, draft, onChange, onError],
  );

  const metaPath = (
    field: "storyTitle" | "bandTitle" | "chapterTitle" | "phaseHint",
  ): StoryFieldPath => ({ scope: "meta", field });

  const updateMeta = (
    field: "storyTitle" | "bandTitle" | "chapterTitle" | "phaseHint",
    value: string,
  ) => onChange(setFieldValue(draft, metaPath(field), value));

  const addLoreEntry = () => {
    const entries = [...draft.worldLorebook.entries];
    entries.push({
      keys: [],
      content: "",
      comment: "",
      order: (entries.length + 1) * 10,
      position: 0,
      enabled: true,
    });
    onChange({
      ...draft,
      worldLorebook: { ...draft.worldLorebook, entries },
    });
  };

  const removeLoreEntry = (index: number) => {
    const entries = draft.worldLorebook.entries.filter((_, i) => i !== index);
    onChange({
      ...draft,
      worldLorebook: { ...draft.worldLorebook, entries },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-accent">
          Meta
        </h3>
        <div className="flex flex-col gap-3">
          <AiField
            label="Story-Titel"
            value={draft.storyTitle}
            onChange={(v) => updateMeta("storyTitle", v)}
            busy={busyKey === fieldPathKey(metaPath("storyTitle"))}
            onRandomize={() => runField(metaPath("storyTitle"))}
          />
          <AiField
            label="Band-Titel"
            value={draft.bandTitle}
            onChange={(v) => updateMeta("bandTitle", v)}
            busy={busyKey === fieldPathKey(metaPath("bandTitle"))}
            onRandomize={() => runField(metaPath("bandTitle"))}
          />
          <AiField
            label="Kapitel-Titel"
            value={draft.chapterTitle}
            onChange={(v) => updateMeta("chapterTitle", v)}
            busy={busyKey === fieldPathKey(metaPath("chapterTitle"))}
            onRandomize={() => runField(metaPath("chapterTitle"))}
          />
          <AiField
            label="Phasen-Hinweis"
            value={draft.phaseHint ?? ""}
            onChange={(v) => updateMeta("phaseHint", v)}
            busy={busyKey === fieldPathKey(metaPath("phaseHint"))}
            onRandomize={() => runField(metaPath("phaseHint"))}
            hint="Optional: Pacing / Akt für das erste Kapitel"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-accent">
          Lorebook
        </h3>
        <div className="mb-3 flex flex-col gap-3">
          <AiField
            label="Lorebook-Name"
            value={draft.worldLorebook.name}
            onChange={(v) =>
              onChange(setFieldValue(draft, { scope: "lore", field: "name" }, v))
            }
            busy={busyKey === "lore.name"}
            onRandomize={() => runField({ scope: "lore", field: "name" })}
          />
          <AiField
            label="Beschreibung"
            value={draft.worldLorebook.description ?? ""}
            onChange={(v) =>
              onChange(
                setFieldValue(draft, { scope: "lore", field: "description" }, v),
              )
            }
            busy={busyKey === "lore.description"}
            onRandomize={() => runField({ scope: "lore", field: "description" })}
            multiline
            rows={2}
          />
        </div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {draft.worldLorebook.entries.length} Einträge
          </span>
          <button
            type="button"
            onClick={addLoreEntry}
            className="text-xs text-accent underline"
          >
            + Eintrag
          </button>
        </div>
        <ul className="flex flex-col gap-4">
          {draft.worldLorebook.entries.map((_, index) => (
            <li
              key={index}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">
                  Lore #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeLoreEntry(index)}
                  className="text-[10px] text-red-400/80"
                >
                  Entfernen
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <AiField
                  label="Keywords (kommagetrennt)"
                  value={getFieldValue(draft, {
                    scope: "loreEntry",
                    index,
                    field: "keys",
                  })}
                  onChange={(v) =>
                    onChange(
                      setFieldValue(
                        draft,
                        { scope: "loreEntry", index, field: "keys" },
                        v,
                      ),
                    )
                  }
                  busy={busyKey === `lore.${index}.keys`}
                  onRandomize={() =>
                    runField({ scope: "loreEntry", index, field: "keys" })
                  }
                />
                <AiField
                  label="Inhalt"
                  value={getFieldValue(draft, {
                    scope: "loreEntry",
                    index,
                    field: "content",
                  })}
                  onChange={(v) =>
                    onChange(
                      setFieldValue(
                        draft,
                        { scope: "loreEntry", index, field: "content" },
                        v,
                      ),
                    )
                  }
                  busy={busyKey === `lore.${index}.content`}
                  onRandomize={() =>
                    runField({ scope: "loreEntry", index, field: "content" })
                  }
                  multiline
                  rows={4}
                />
                <AiField
                  label="Kommentar"
                  value={getFieldValue(draft, {
                    scope: "loreEntry",
                    index,
                    field: "comment",
                  })}
                  onChange={(v) =>
                    onChange(
                      setFieldValue(
                        draft,
                        { scope: "loreEntry", index, field: "comment" },
                        v,
                      ),
                    )
                  }
                  busy={busyKey === `lore.${index}.comment`}
                  onRandomize={() =>
                    runField({ scope: "loreEntry", index, field: "comment" })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-accent">
          Figuren
        </h3>
        <ul className="flex flex-col gap-5">
          {draft.characters.map((ch, index) => (
            <li
              key={`${ch.slug}-${index}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
            >
              <p className="mb-3 text-xs text-zinc-500">
                <span className="font-medium text-accent">{ch.role}</span>
                {ch.slug ? ` · ${ch.slug}` : null}
              </p>
              <div className="flex flex-col gap-2">
                <AiField
                  label="Slug"
                  value={ch.slug}
                  onChange={(v) =>
                    onChange(
                      setFieldValue(
                        draft,
                        { scope: "character", index, field: "slug" },
                        v,
                      ),
                    )
                  }
                  busy={busyKey === `char.${index}.slug`}
                  onRandomize={() =>
                    runField({ scope: "character", index, field: "slug" })
                  }
                />
                {CARD_FIELDS.map((field) => (
                  <AiField
                    key={field}
                    label={CARD_LABELS[field]}
                    value={ch.card[field] ?? ""}
                    onChange={(v) =>
                      onChange(
                        setFieldValue(
                          draft,
                          { scope: "characterCard", index, field },
                          v,
                        ),
                      )
                    }
                    busy={busyKey === `char.${index}.${field}`}
                    onRandomize={() =>
                      runField({ scope: "characterCard", index, field })
                    }
                    multiline={
                      field === "first_mes" ||
                      field === "system_prompt" ||
                      field === "description"
                    }
                    rows={
                      field === "first_mes"
                        ? 8
                        : field === "system_prompt"
                          ? 6
                          : 3
                    }
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

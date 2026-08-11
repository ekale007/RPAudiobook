"use client";

import { type ReactNode } from "react";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { getHoerbuchkiExtensions } from "@/lib/images/characterAvatar";
import type { CharacterRow } from "@/lib/db/stories";
import type { StoryCharacterCard } from "@/lib/types";
import type { CastField } from "@/lib/cast/castFieldAi";

type Draft = {
  description: string;
  personality: string;
  memory: string;
  archived: boolean;
  reason: string;
};

function AiBadge({
  busy,
  onClick,
  label = "KI",
}: {
  busy: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      title="KI-Vorschlag für dieses Feld (nutzt Story-Konzept)"
      className="shrink-0 rounded-md border border-violet-800/60 bg-violet-950/40 px-2 py-0.5 text-[10px] font-medium text-violet-200 disabled:opacity-40"
    >
      {busy ? "…" : `🎲 ${label}`}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  rows = 2,
  busy,
  onAi,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  busy: boolean;
  onAi: () => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <label className="text-[10px] text-zinc-500">{label}</label>
        <AiBadge busy={busy} onClick={onAi} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-[11px] leading-relaxed text-zinc-200"
      />
    </div>
  );
}

export function CastCharacterCard({
  character,
  isNarrator,
  expanded,
  onToggle,
  draft,
  onDraftChange,
  busyField,
  onAiSuggest,
  busySaving,
  onSave,
  voiceLabel,
  footer,
}: {
  character: CharacterRow;
  isNarrator: boolean;
  expanded: boolean;
  onToggle: () => void;
  draft: Draft;
  onDraftChange: (patch: Partial<Draft>) => void;
  busyField: CastField | null;
  onAiSuggest: (field: CastField) => void;
  busySaving: boolean;
  onSave: () => void;
  voiceLabel?: string | null;
  footer?: ReactNode;
}) {
  const card = character.card_json;
  const tagline =
    card.personality?.trim() ||
    card.description?.trim() ||
    character.character_memory?.trim()?.slice(0, 80) ||
    null;

  return (
    <li
      className={`overflow-hidden rounded-xl border ${
        draft.archived
          ? "border-zinc-800 bg-zinc-900/40 opacity-70"
          : "border-surface-border bg-surface-raised/90"
      }`}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 p-3 text-left active:bg-surface/60"
      >
        <CharacterAvatar
          name={character.name}
          avatarStoragePath={
            getHoerbuchkiExtensions(card as StoryCharacterCard).avatarStoragePath
          }
          className="h-10 w-10 shrink-0 ring-2 ring-surface-border/80"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {character.name}
          </p>
          <p className={`text-[9px] font-medium uppercase tracking-wide ${
            isNarrator ? "text-accent" : draft.archived ? "text-zinc-600" : "text-zinc-500"
          }`}>
            {isNarrator ? "Erzähler" : draft.archived ? "Archiviert" : character.role === "npc" ? "NPC" : "Cast"}
          </p>
        </div>
        {voiceLabel ? (
          <span className="hidden shrink-0 text-[9px] text-zinc-600 sm:block">
            ♪ {voiceLabel}
          </span>
        ) : null}
        <span className="shrink-0 text-zinc-600">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Tagline (collapsed) */}
      {!expanded && tagline ? (
        <p className="px-3 pb-3 text-[10px] leading-snug text-zinc-500">
          {tagline}
        </p>
      ) : null}

      {/* Expanded editor */}
      {expanded ? (
        <div className="space-y-3 border-t border-surface-border/60 p-3">
          <Field
            label="Beschreibung"
            value={draft.description}
            onChange={(v) => onDraftChange({ description: v })}
            rows={2}
            busy={busyField === "description"}
            onAi={() => onAiSuggest("description")}
            placeholder="Aussehen, Rolle, Hintergrund …"
          />
          <Field
            label="Persönlichkeit"
            value={draft.personality}
            onChange={(v) => onDraftChange({ personality: v })}
            rows={2}
            busy={busyField === "personality"}
            onAi={() => onAiSuggest("personality")}
            placeholder="Wie spricht/fühlt/reagiert die Figur?"
          />
          <Field
            label="Erinnerungen (Story-Memory)"
            value={draft.memory}
            onChange={(v) => onDraftChange({ memory: v })}
            rows={4}
            busy={busyField === "memory"}
            onAi={() => onAiSuggest("memory")}
            placeholder="Was die Story über diese Figur weiß …"
          />

          {!isNarrator ? (
            <div className="space-y-1.5">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-500">
                <input
                  type="checkbox"
                  checked={draft.archived}
                  onChange={(e) => onDraftChange({ archived: e.target.checked })}
                  className="size-3 rounded border-surface-border"
                />
                Figur archivieren
              </label>
              {draft.archived ? (
                <input
                  value={draft.reason}
                  onChange={(e) => onDraftChange({ reason: e.target.value })}
                  placeholder="Grund (z. B. tot, weggegangen)"
                  className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1 text-[11px]"
                />
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busySaving}
              onClick={onSave}
              className="rounded-lg bg-accent/20 px-3 py-1.5 text-xs text-accent disabled:opacity-40"
            >
              {busySaving ? "Speichert …" : "Figur speichern"}
            </button>
            {footer}
          </div>
        </div>
      ) : null}
    </li>
  );
}
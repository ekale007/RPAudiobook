"use client";

import { useState } from "react";
import type { LoreEntry } from "@/lib/types";

/**
 * Card-based lore entry editor: chat-tag keys (chips instead of CSV),
 * inline title + content, per-field AI suggestions, order controls.
 */
export function LoreEntryCard({
  index,
  entry,
  total,
  busyField,
  onChange,
  onRemove,
  onMove,
  onAiSuggest,
  className,
}: {
  index: number;
  entry: LoreEntry;
  total: number;
  busyField: string | null;
  onChange: (patch: Partial<LoreEntry>) => void;
  onRemove: () => void;
  onMove?: (dir: -1 | 1) => void;
  onAiSuggest: (field: "comment" | "keys" | "content") => void;
  className?: string;
}) {
  const [keyDraft, setKeyDraft] = useState("");

  const addKey = () => {
    const k = keyDraft.trim();
    if (!k) return;
    if (!entry.keys.includes(k)) {
      onChange({ keys: [...entry.keys, k] });
    }
    setKeyDraft("");
  };

  const removeKey = (k: string) => {
    onChange({ keys: entry.keys.filter((x) => x !== k) });
  };

  const aiBtn = (field: "comment" | "keys" | "content", label: string) => (
    <button
      type="button"
      disabled={busyField === field}
      onClick={() => onAiSuggest(field)}
      title="KI-Vorschlag für dieses Feld"
      className="shrink-0 rounded-md border border-violet-800/60 bg-violet-950/40 px-2 py-0.5 text-[10px] font-medium text-violet-200 disabled:opacity-40"
    >
      {busyField === field ? "…" : `🎲 ${label}`}
    </button>
  );

  return (
    <li
      className={`overflow-hidden rounded-xl border bg-surface-raised/90 ${
        entry.enabled === false
          ? "border-zinc-800 opacity-60"
          : "border-surface-border"
      } ${className ?? ""}`}
    >
      {/* Card header: index, enable, move, remove */}
      <div className="flex items-center gap-2 border-b border-surface-border/60 px-3 py-1.5">
        <span className="text-[10px] font-medium text-zinc-500">
          #{index + 1}
        </span>
        <div className="min-w-0 flex-1" />
        <label className="flex cursor-pointer items-center gap-1 text-[10px] text-zinc-500">
          <input
            type="checkbox"
            checked={entry.enabled !== false}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="size-3 rounded border-surface-border"
          />
          Aktiv
        </label>
        {onMove && total > 1 ? (
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
            title="Nach oben"
          >
            ↑
          </button>
        ) : null}
        {onMove && total > 1 ? (
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
            title="Nach unten"
          >
            ↓
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-600 hover:text-red-400"
          title="Eintrag entfernen"
        >
          ×
        </button>
      </div>

      <div className="space-y-2 p-3">
        {/* Title */}
        <div>
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <label className="text-[10px] text-zinc-500">Titel</label>
            {aiBtn("comment", "Titel")}
          </div>
          <input
            value={entry.comment ?? ""}
            onChange={(e) => onChange({ comment: e.target.value })}
            placeholder="z. B. Die Stadt Eldergard"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
          />
        </div>

        {/* Keys as chips */}
        <div>
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <label className="text-[10px] text-zinc-500">
              Auslöser-Keywords
            </label>
            {aiBtn("keys", "Keywords")}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5">
            {entry.keys.map((k) => (
              <span
                key={k}
                className="flex items-center gap-1 rounded-full border border-violet-800/50 bg-violet-950/40 px-2 py-0.5 text-[10px] text-violet-200"
              >
                {k}
                <button
                  type="button"
                  onClick={() => removeKey(k)}
                  className="text-violet-400 hover:text-violet-200"
                  title="Keyword entfernen"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addKey();
                }
              }}
              onBlur={addKey}
              placeholder={entry.keys.length ? "+ Keyword" : "Eingeben + Enter"}
              className="min-w-24 flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </div>
          <p className="mt-0.5 text-[9px] text-zinc-600">
            Werden im Chat-Text gefunden → Eintrag kommt in den Prompt
          </p>
        </div>

        {/* Content */}
        <div>
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <label className="text-[10px] text-zinc-500">Inhalt</label>
            {aiBtn("content", "Inhalt")}
          </div>
          <textarea
            value={entry.content}
            onChange={(e) => onChange({ content: e.target.value })}
            rows={4}
            placeholder="Was das Modell über dieses Thema wissen soll …"
            className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm leading-relaxed text-zinc-100"
          />
        </div>
      </div>
    </li>
  );
}
"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { MessageAudioPlayer } from "@/components/MessageAudioPlayer";
import { speakerDisplayName } from "@/lib/chat/speakerDisplay";
import type { MessageAudioPlayerHandle } from "@/lib/tts/messageAudioPlayerHandle";
import { displayNameForSpeakerSlug, extractMarkedSnippets, speakerLabelsForSlug } from "@/lib/chat/dialogueSpeakerInference";
import {
  buildDialogueAttributionMap,
  formatScriptAttributionDebug,
} from "@/lib/chat/dialogueScript";
import { useDialogueAttribution } from "@/lib/chat/useDialogueAttribution";
import { stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import { prepareTextForTts } from "@/lib/tts/prepareTtsText";
import type { CharacterRow, TurnRow } from "@/lib/db/stories";
import type { VoiceMap, StorySettings } from "@/lib/types";
import { isCastVoiceActive, type VoiceEnabledSlugs } from "@/lib/tts/voiceActivation";
import {
  normalizeStoryContentLocale,
  PROTAGONIST_SPEAKER_SLUG,
} from "@/lib/story/protagonist";

export function ChatTurnBubble({
  turn,
  cast,
  voiceMap,
  voiceEnabledSlugs,
  readOnly,
  onEdit,
  onRewind,
  onReroll,
  onStoragePath,
  registerTtsPlayer,
  ttsAutoplayChain,
  onTtsChainPlay,
  ttsPlaying = false,
  ttsQueued = false,
  onTtsPlaybackChange,
  navFocused = false,
  showDialogueMarkup = true,
  storyLocale,
  storySettings,
  chapterTitle,
}: {
  turn: TurnRow;
  cast: CharacterRow[];
  voiceMap: VoiceMap;
  voiceEnabledSlugs?: VoiceEnabledSlugs;
  readOnly: boolean;
  onEdit: (turnId: string, content: string) => Promise<void>;
  onRewind: (turnId: string) => Promise<void>;
  onReroll?: (turnId: string) => Promise<void>;
  onStoragePath?: (turnId: string, path: string) => void;
  registerTtsPlayer?: (
    turnId: string,
    player: MessageAudioPlayerHandle | null,
  ) => void;
  ttsAutoplayChain?: boolean;
  onTtsChainPlay?: (turnId: string) => void;
  ttsPlaying?: boolean;
  ttsQueued?: boolean;
  onTtsPlaybackChange?: (turnId: string, active: boolean) => void;
  navFocused?: boolean;
  /** Highlight dialogue/thought snippets that use a cast TTS voice. */
  showDialogueMarkup?: boolean;
  storyLocale?: string;
  storySettings?: StorySettings;
  chapterTitle?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(turn.content);
  const [busy, setBusy] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const contentLocale = normalizeStoryContentLocale(storyLocale);
  const displayContent = stripSpeakerTags(turn.content);
  const markedSnippets = useMemo(
    () =>
      showDialogueMarkup &&
      turn.role === "assistant" &&
      (turn.speaker_slug ?? "narrator") === "narrator"
        ? extractMarkedSnippets(displayContent, contentLocale)
        : [],
    [
      showDialogueMarkup,
      turn.role,
      turn.speaker_slug,
      displayContent,
      contentLocale,
    ],
  );
  const llmAttribution = useDialogueAttribution(
    turn.id,
    turn.content,
    cast,
    markedSnippets.length > 0 && turn.role === "assistant",
    {
      locale: contentLocale,
      protagonist: storySettings?.protagonist,
    },
  );
  const markedLookup = useMemo(() => {
    const attribution = buildDialogueAttributionMap(
      turn.content,
      cast,
      llmAttribution ?? undefined,
      contentLocale,
    );
    const map = new Map<string, string>();
    for (const s of markedSnippets) {
      map.set(s, attribution.get(s) ?? "narrator");
    }
    return map;
  }, [markedSnippets, turn.content, cast, llmAttribution]);
  const ttsContent = displayContent;
  const effectiveSegmentOverrides = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [snippet, slug] of markedLookup.entries()) {
      if (
        slug &&
        slug !== "narrator" &&
        (slug === PROTAGONIST_SPEAKER_SLUG ||
          isCastVoiceActive(slug, voiceEnabledSlugs))
      ) {
        out[snippet] = slug;
      }
    }
    return out;
  }, [markedLookup, voiceEnabledSlugs]);

  const saveEdit = async () => {
    const text = draft.trim();
    if (!text || text === turn.content) {
      setEditing(false);
      setDraft(turn.content);
      return;
    }
    setBusy(true);
    try {
      await onEdit(turn.id, text);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const actRewind = async (fn: () => Promise<void>) => {
    if (
      !confirm(
        "Ab hier löschen? Diese Nachricht und alles danach werden entfernt.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const actReroll = async (fn: () => Promise<void>) => {
    if (!confirm("Neue Version dieser Erzählung generieren?")) {
      return;
    }
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const copyRaw = async () => {
    const raw = turn.content;
    if (!raw.trim()) return;
    const isNarratorAssistant =
      turn.role === "assistant" &&
      (turn.speaker_slug ?? "narrator") === "narrator";
    const payload = isNarratorAssistant
      ? [raw, "", formatScriptAttributionDebug(raw, cast, llmAttribution ?? undefined)].join(
          "\n",
        )
      : raw;
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(payload);
      } else {
        const ta = document.createElement("textarea");
        ta.value = payload;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("copy failed");
      }
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 1500);
    } catch {
      alert("Copy failed. Use Edit and copy manually.");
    }
  };

  return (
    <div
      className={`mb-3 flex ${turn.role === "user" ? "justify-end" : "justify-start"} ${
        navFocused ? "rounded-2xl ring-1 ring-accent/30" : ""
      }`}
    >
      <div
        className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-sm transition-[box-shadow,border-color,background-color] duration-300 ${
          turn.role === "user"
            ? "bg-accent/20 text-zinc-100"
            : ttsPlaying
              ? "border-2 border-accent bg-surface-raised shadow-[0_0_20px_rgba(250,204,21,0.12)] ring-1 ring-accent/40"
              : ttsQueued
                ? "border border-accent/35 bg-surface-raised/90 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.08)]"
                : "bg-surface-raised border border-surface-border"
        }`}
      >
        {turn.role === "assistant" && turn.speaker_slug ? (
          <p className="mb-1 text-xs font-medium text-accent">
            {speakerDisplayName(turn.speaker_slug, cast)}
            {ttsPlaying ? (
              <span className="ml-2 font-normal text-accent/80">· läuft</span>
            ) : ttsQueued ? (
              <span className="ml-2 font-normal text-zinc-500">· in Warteschlange</span>
            ) : null}
          </p>
        ) : turn.role === "assistant" ? (
          <p className="mb-1 text-xs font-medium text-zinc-500">
            Narrator
            {ttsPlaying ? (
              <span className="ml-2 text-accent/80">· läuft</span>
            ) : ttsQueued ? (
              <span className="ml-2">· in Warteschlange</span>
            ) : null}
          </p>
        ) : null}

        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-zinc-100"
          />
        ) : showDialogueMarkup && markedSnippets.length > 0 ? (
          <div className="prose-chat">
            {renderInlineMarkedContent({
              text: displayContent,
              snippets: markedSnippets,
              selectedBySnippet: markedLookup,
              cast,
              voiceMap,
              voiceEnabledSlugs,
            })}
          </div>
        ) : (
          <p className="prose-chat">{displayContent}</p>
        )}

        {turn.role === "assistant" && !turn.id.startsWith("tmp-") ? (
          <MessageAudioPlayer
            ref={(handle) => registerTtsPlayer?.(turn.id, handle)}
            turnId={turn.id}
            rawContent={turn.content}
            text={prepareTextForTts(
              ttsContent,
              turn.speaker_slug,
              cast,
            )}
            speakerSlug={turn.speaker_slug}
            voiceMap={voiceMap}
            segmentOverrides={effectiveSegmentOverrides}
            cast={cast}
            voiceEnabledSlugs={voiceEnabledSlugs}
            audioStoragePath={turn.audio_storage_path}
            onStoragePath={(path) => onStoragePath?.(turn.id, path)}
            autoplayChain={ttsAutoplayChain}
            onChainPlay={
              onTtsChainPlay ? () => onTtsChainPlay(turn.id) : undefined
            }
            onPlaybackActiveChange={(active) =>
              onTtsPlaybackChange?.(turn.id, active)
            }
            storyLocale={storyLocale}
            storySettings={storySettings}
            chapterTitle={chapterTitle}
          />
        ) : null}

        {!readOnly && !turn.id.startsWith("tmp-") ? (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-surface-border/60 pt-2">
            {editing ? (
              <>
                <ActionBtn
                  ariaLabel="Speichern"
                  disabled={busy}
                  onClick={saveEdit}
                  accent
                >
                  <IconCheck />
                </ActionBtn>
                <ActionBtn
                  ariaLabel="Abbrechen"
                  disabled={busy}
                  onClick={() => {
                    setDraft(turn.content);
                    setEditing(false);
                  }}
                >
                  <IconX />
                </ActionBtn>
              </>
            ) : (
              <>
                <ActionBtn
                  ariaLabel="Bearbeiten"
                  disabled={busy}
                  onClick={() => {
                    setDraft(turn.content);
                    setEditing(true);
                  }}
                >
                  <IconPencil />
                </ActionBtn>
                <ActionBtn
                  ariaLabel="Ab hier löschen"
                  disabled={busy}
                  onClick={() => actRewind(() => onRewind(turn.id))}
                >
                  <IconTrash />
                </ActionBtn>
                {turn.role === "assistant" && onReroll ? (
                  <ActionBtn
                    ariaLabel="Neu generieren"
                    disabled={busy}
                    onClick={() => actReroll(() => onReroll(turn.id))}
                  >
                    <IconReroll />
                  </ActionBtn>
                ) : null}
                {turn.role === "assistant" ? (
                  <ActionBtn
                    ariaLabel={copiedRaw ? "Kopiert" : "Rohdaten kopieren"}
                    disabled={busy}
                    onClick={copyRaw}
                  >
                    {copiedRaw ? <IconCheck /> : <IconCopy />}
                  </ActionBtn>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type HighlightRange = {
  start: number;
  end: number;
  slug: string;
  kind: "dialogue" | "speaker";
};

function renderInlineMarkedContent(args: {
  text: string;
  snippets: string[];
  selectedBySnippet: Map<string, string>;
  cast: CharacterRow[];
  voiceMap: VoiceMap;
  voiceEnabledSlugs?: VoiceEnabledSlugs;
}) {
  const { text, snippets, selectedBySnippet, cast, voiceMap, voiceEnabledSlugs } =
    args;
  const ranges = buildHighlightRanges(
    text,
    snippets,
    selectedBySnippet,
    cast,
    voiceEnabledSlugs,
  );
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const range of ranges) {
    if (range.start < cursor) continue;
    const plain = text.slice(cursor, range.start);
    if (plain) nodes.push(<Fragment key={`t-${key++}`}>{plain}</Fragment>);

    const color = colorForSpeaker(range.slug, cast, voiceMap);
    const slice = text.slice(range.start, range.end);

    if (range.kind === "dialogue") {
      nodes.push(
        <span
          key={`d-${key++}`}
          className="mx-[1px] rounded px-0.5 py-[1px]"
          style={{
            backgroundColor: `${color}33`,
            borderBottom: `2px solid ${color}`,
          }}
          title={`Dialog · ${displayNameForSpeakerSlug(range.slug, cast)}`}
        >
          {slice}
        </span>,
      );
    } else {
      nodes.push(
        <span
          key={`s-${key++}`}
          className="mx-[1px] rounded px-0.5 font-semibold"
          style={{
            color,
            backgroundColor: `${color}28`,
          }}
          title={`Sprecher · ${displayNameForSpeakerSlug(range.slug, cast)}`}
        >
          {slice}
        </span>,
      );
    }
    cursor = range.end;
  }

  const tail = text.slice(cursor);
  if (tail) nodes.push(<Fragment key={`t-${key++}`}>{tail}</Fragment>);
  return nodes;
}

function buildHighlightRanges(
  text: string,
  snippets: string[],
  selectedBySnippet: Map<string, string>,
  cast: CharacterRow[],
  voiceEnabledSlugs?: VoiceEnabledSlugs,
): HighlightRange[] {
  const occurrences: Array<{ start: number; end: number; snippet: string }> =
    [];
  for (const snippet of snippets) {
    const idx = text.indexOf(snippet);
    if (idx >= 0) {
      occurrences.push({
        start: idx,
        end: idx + snippet.length,
        snippet,
      });
    }
  }
  occurrences.sort((a, b) => a.start - b.start);

  const ranges: HighlightRange[] = [];
  for (const occ of occurrences) {
    const slug = selectedBySnippet.get(occ.snippet) ?? "narrator";
    if (slug === "narrator" || !isCastVoiceActive(slug, voiceEnabledSlugs)) {
      continue;
    }
    ranges.push({
      start: occ.start,
      end: occ.end,
      slug,
      kind: "dialogue",
    });
    for (const span of findSpeakerAttributionSpans(
      text,
      occ.start,
      occ.end,
      slug,
      cast,
    )) {
      ranges.push({ ...span, slug, kind: "speaker" });
    }
  }
  return mergeHighlightRanges(ranges);
}

function mergeHighlightRanges(ranges: HighlightRange[]): HighlightRange[] {
  const dialogue = ranges
    .filter((r) => r.kind === "dialogue")
    .sort((a, b) => a.start - b.start);
  const speakers = ranges
    .filter((r) => r.kind === "speaker")
    .sort((a, b) => a.start - b.start);

  const clipped: HighlightRange[] = [];
  for (const s of speakers) {
    let parts = [{ start: s.start, end: s.end }];
    for (const d of dialogue) {
      parts = parts.flatMap((p) => subtractInterval(p, d.start, d.end));
    }
    for (const p of parts) {
      if (p.end > p.start) {
        clipped.push({ ...s, start: p.start, end: p.end });
      }
    }
  }

  const merged = [...dialogue, ...clipped].sort((a, b) => a.start - b.start);
  const out: HighlightRange[] = [];
  let cursor = -1;
  for (const r of merged) {
    if (r.start < cursor) continue;
    out.push(r);
    cursor = r.end;
  }
  return out;
}

function subtractInterval(
  part: { start: number; end: number },
  cutStart: number,
  cutEnd: number,
): Array<{ start: number; end: number }> {
  if (cutEnd <= part.start || cutStart >= part.end) return [part];
  const out: Array<{ start: number; end: number }> = [];
  if (cutStart > part.start) out.push({ start: part.start, end: cutStart });
  if (cutEnd < part.end) out.push({ start: cutEnd, end: part.end });
  return out;
}

function findSpeakerAttributionSpans(
  text: string,
  quoteStart: number,
  quoteEnd: number,
  speakerSlug: string,
  cast: CharacterRow[],
): Array<{ start: number; end: number }> {
  const windowStart = Math.max(0, quoteStart - 220);
  const windowEnd = Math.min(text.length, quoteEnd + 40);
  const labels = speakerLabelsForSlug(speakerSlug, cast);
  const spans: Array<{ start: number; end: number }> = [];
  const seen = new Set<string>();

  for (const label of labels) {
    if (!label || label.length < 2) continue;
    const re = new RegExp(`\\b${escapeRegex(label)}\\b`, "gi");
    const segment = text.slice(windowStart, windowEnd);
    for (const m of segment.matchAll(re)) {
      const start = windowStart + (m.index ?? 0);
      const end = start + m[0].length;
      if (start >= quoteStart && end <= quoteEnd) continue;
      const key = `${start}:${end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      spans.push({ start, end });
    }
  }
  return spans;
}

function colorForSpeaker(
  speakerSlug: string,
  cast: CharacterRow[],
  voiceMap: VoiceMap,
): string {
  if (speakerSlug === "narrator") return "#7c7c8a";
  if (speakerSlug.startsWith("npc:")) return "#94a3b8";
  const salt = voiceMap[speakerSlug]
    ? `${speakerSlug}:${voiceMap[speakerSlug]}`
    : speakerSlug;
  let hash = 0;
  for (let i = 0; i < salt.length; i++) hash = (hash * 31 + salt.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  const sat =
    voiceMap[speakerSlug] || speakerSlug.startsWith("guest:") ? 72 : 58;
  const light =
    voiceMap[speakerSlug] || speakerSlug.startsWith("guest:") ? 62 : 55;
  const known =
    cast.find((c) => c.slug === speakerSlug) || speakerSlug.startsWith("guest:");
  if (!known) return "#7c7c8a";
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ActionBtn({
  ariaLabel,
  onClick,
  disabled,
  accent,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`flex h-7 w-7 items-center justify-center rounded-lg ${
        accent
          ? "bg-accent text-black"
          : "border border-surface-border text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

const iconClass = "h-3.5 w-3.5 shrink-0";

function IconPencil() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={iconClass} aria-hidden>
      <path
        d="M11.2 2.8l2 2-8.5 8.5H2.7v-2l8.5-8.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 4l2 2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={iconClass} aria-hidden>
      <path
        d="M3.5 4.5h9M6 4.5V3.8a.8.8 0 01.8-.8h2.4a.8.8 0 01.8.8V4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4 4.5l.6 7.5a1 1 0 001 .9h4.8a1 1 0 001-.9l.6-7.5M6.5 7v3.5M9.5 7v3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconReroll() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={iconClass} aria-hidden>
      <path
        d="M6.8 11.6A3.8 3.8 0 1 1 10.7 5.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9.8 6.1l1.3-.9M9.8 6.1l.7 1.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={iconClass} aria-hidden>
      <rect
        x="5.5"
        y="5.5"
        width="7"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4.5 10.5h-.8a1 1 0 01-1-1v-7a1 1 0 011-1h7a1 1 0 011 1v.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={iconClass} aria-hidden>
      <path
        d="M3.5 8.2l2.8 2.8 6.2-6.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={iconClass} aria-hidden>
      <path
        d="M4.5 4.5l7 7M11.5 4.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatTurnBubble } from "@/components/ChatTurnBubble";
import {
  parseAssistantBlocks,
  streamAssistantReply,
} from "@/lib/chat/generateReply";
import { nextTurnIndex, rerollDeleteFromIndex } from "@/lib/chat/turnRounds";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";
import { summarizeRolling } from "@/lib/chapter/summarize";
import type {
  ChatMode,
  ChatTurn,
  LoreEntry,
  StorySettings,
  VoiceMap,
  WryTourCharacter,
} from "@/lib/types";
import {
  appendAssistantBlocks,
  appendTurn,
  getTurns,
  updateChapterSummaries,
  type ChapterRow,
  type CharacterRow,
  type TurnRow,
} from "@/lib/db/stories";
import { truncateTurnsFrom, updateTurnContent } from "@/lib/db/turns";
import { mergeVoiceMap } from "@/lib/tts/defaultVoiceMap";
import Link from "next/link";

function turnsToChat(turns: TurnRow[]): ChatTurn[] {
  return turns.map((t) => ({
    role: t.role as ChatTurn["role"],
    content: t.content,
    speakerSlug: t.speaker_slug,
  }));
}

export function ChatView({
  storyId,
  chapterId,
  character,
  cast,
  storySettings,
  loreEntries,
  chapter,
  bandSummary,
  priorChapterSummaries,
  readOnly = false,
}: {
  storyId: string;
  chapterId: string;
  character: WryTourCharacter;
  cast: CharacterRow[];
  storySettings: StorySettings;
  loreEntries: LoreEntry[];
  chapter: ChapterRow;
  bandSummary?: string | null;
  priorChapterSummaries?: string | null;
  readOnly?: boolean;
}) {
  const chatMode: ChatMode = storySettings.chatMode ?? "narrator";
  const voiceMap: VoiceMap = mergeVoiceMap(storySettings.voiceMap);

  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loreCount, setLoreCount] = useState(0);
  const [rollingSummary, setRollingSummary] = useState(
    chapter.rolling_summary,
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const rows = await getTurns(chapterId);
    setTurns(rows);
  }, [chapterId]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, streamBuffer]);

  const maybeSummarize = async (rows: TurnRow[]) => {
    if (rows.length > 0 && rows.length % 10 === 0) {
      const s = loadOpenRouterSettings();
      if (s) {
        const updated = await summarizeRolling(
          s,
          turnsToChat(rows.slice(-10)),
          rollingSummary,
        );
        setRollingSummary(updated);
        await updateChapterSummaries(chapterId, {
          rolling_summary: updated,
        });
      }
    }
  };

  const persistAssistantReply = async (
    full: string,
    startIndex: number,
  ) => {
    const blocks = parseAssistantBlocks(chatMode, full);
    if (chatMode === "group" && blocks.length > 1) {
      await appendAssistantBlocks(chapterId, startIndex, blocks, storyId);
    } else {
      await appendTurn(
        chapterId,
        startIndex,
        "assistant",
        blocks[0]?.content ?? full,
        storyId,
        blocks[0]?.speakerSlug ?? "narrator",
      );
    }
    const rows = await getTurns(chapterId);
    setTurns(rows);
    await maybeSummarize(rows);
  };

  const runGeneration = async (
    history: TurnRow[],
    opts: { continuation?: boolean },
  ) => {
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setError("Add your OpenRouter API key in Settings first.");
      return;
    }

    setError(null);
    setStreaming(true);
    setStreamBuffer("");
    abortRef.current = new AbortController();

    const full = await streamAssistantReply({
      settings,
      chatMode,
      character,
      cast,
      loreEntries,
      turns: turnsToChat(history),
      storySettings,
      bandSummary,
      chapterSummary: priorChapterSummaries,
      rollingSummary,
      continuation: opts.continuation,
      onToken: (t) => setStreamBuffer((b) => b + t),
      onLoreCount: setLoreCount,
      signal: abortRef.current.signal,
    });

    setStreamBuffer("");
    setStreaming(false);

    if (!full.trim()) return;

    const startIndex = nextTurnIndex(history);
    await persistAssistantReply(full, startIndex);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming || readOnly) return;

    setInput("");
    const userIndex = nextTurnIndex(turns);
    const optimisticUser: TurnRow = {
      id: `tmp-u-${userIndex}`,
      chapter_id: chapterId,
      index_in_chapter: userIndex,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setTurns((prev) => [...prev, optimisticUser]);

    try {
      await appendTurn(chapterId, userIndex, "user", text, storyId);
    } catch (e) {
      setError(String(e));
      setStreaming(false);
      return;
    }

    const history = [...turns, optimisticUser];
    await runGeneration(history, {});
  };

  const continueStory = async () => {
    if (streaming || readOnly || !turns.length) return;
    await runGeneration(turns, { continuation: true });
  };

  const handleEdit = async (turnId: string, content: string) => {
    await updateTurnContent(turnId, content, storyId);
    const rows = await getTurns(chapterId);
    setTurns(rows);
  };

  const handleRewind = async (turnId: string) => {
    const turn = turns.find((t) => t.id === turnId);
    if (!turn) return;
    const rows = await truncateTurnsFrom(
      chapterId,
      turn.index_in_chapter,
      storyId,
    );
    setTurns(rows);
    if (streaming) abortRef.current?.abort();
  };

  const handleReroll = async (turnId: string) => {
    const fromIdx = rerollDeleteFromIndex(turns, turnId);
    if (fromIdx === null) return;

    const kept = turns.filter((t) => t.index_in_chapter < fromIdx);
    const hasUser = kept.some((t) => t.role === "user");
    if (!hasUser) {
      setError("Need a user message before this reply to reroll.");
      return;
    }

    const rows = await truncateTurnsFrom(chapterId, fromIdx, storyId);
    setTurns(rows);
    await runGeneration(rows, {});
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {chatMode === "group" ? (
          <p className="mb-2 text-center text-xs text-accent/80">
            Group chat — cast can reply
          </p>
        ) : null}
        {loreCount > 0 ? (
          <p className="mb-2 text-center text-xs text-zinc-500">
            {loreCount} lore entries active
          </p>
        ) : null}

        {turns.map((t) => (
          <ChatTurnBubble
            key={t.id}
            turn={t}
            cast={cast}
            voiceMap={voiceMap}
            readOnly={readOnly}
            onEdit={handleEdit}
            onRewind={handleRewind}
            onReroll={t.role === "assistant" ? handleReroll : undefined}
            onStoragePath={(id, path) => {
              setTurns((prev) =>
                prev.map((row) =>
                  row.id === id ? { ...row, audio_storage_path: path } : row,
                ),
              );
            }}
          />
        ))}

        {streamBuffer ? (
          <div className="mb-3 flex justify-start">
            <div className="max-w-[92%] rounded-2xl border border-surface-border bg-surface-raised px-4 py-2.5 text-sm opacity-90">
              <p className="mb-1 text-xs text-zinc-500">Generating…</p>
              <p className="prose-chat">{streamBuffer}</p>
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="px-4 pb-2 text-center text-sm text-red-400">{error}</p>
      ) : null}

      <div className="safe-bottom border-t border-surface-border bg-surface px-3 py-3">
        <div className="mb-2 flex gap-2 overflow-x-auto text-xs">
          <Link
            href={`/story/${storyId}`}
            className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-400"
          >
            Story
          </Link>
          <Link
            href={`/story/${storyId}/voices`}
            className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-400"
          >
            Voices
          </Link>
          {!readOnly ? (
            <Link
              href={`/story/${storyId}/chapter`}
              className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-400"
            >
              Close chapter
            </Link>
          ) : null}
        </div>

        {!readOnly ? (
          <button
            type="button"
            onClick={continueStory}
            disabled={streaming || turns.length === 0}
            className="mb-2 w-full rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm text-accent disabled:opacity-40"
          >
            Continue — narrator goes on
          </button>
        ) : null}

        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={
              readOnly
                ? "Read-only chapter"
                : chatMode === "group"
                  ? "What do you do or say?"
                  : "What do you do?"
            }
            className="flex-1 resize-none rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base outline-none focus:border-accent"
            disabled={streaming || readOnly}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={streaming || readOnly || !input.trim()}
            className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

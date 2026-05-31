"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BubbleNavArrows } from "@/components/BubbleNavArrows";
import { ChatTurnBubble } from "@/components/ChatTurnBubble";
import { AutoPlayControls } from "@/components/AutoPlayControls";
import { formatLlmLimitError } from "@/components/LlmUsagePanel";
import { MobileCollapsibleTools } from "@/components/MobileCollapsibleTools";
import { StoryBeatPicker } from "@/components/StoryBeatPicker";
import {
  readTtsAutoplayPreference,
  TtsAutoplayToggle,
} from "@/components/TtsAutoplayToggle";
import {
  autoContinuePrompt,
  type AutoPlayTurnCount,
  type DriveModeMinutes,
} from "@/lib/chat/autoContinue";
import { ensureDialogueAttribution, prefetchDialogueAttributionBatch } from "@/lib/chat/resolveDialogueAttribution";
import { formatScriptAttributionDebug } from "@/lib/chat/dialogueScript";
import {
  parseAssistantBlocks,
  streamAssistantReply,
} from "@/lib/chat/generateReply";
import {
  buildPlayBeatPrompt,
  defaultContinuePrompt,
  fetchStoryBeatSuggestions,
  type StoryBeatOption,
} from "@/lib/chat/storyBeatSuggestions";
import { nextTurnIndex, rerollAssistantPrompt, rerollDeleteFromIndex } from "@/lib/chat/turnRounds";
import {
  loadOpenRouterSettings,
  resolveChatModelSettings,
} from "@/lib/storage/openRouterSettings";
import { regenerateRollingSummary } from "@/lib/chapter/rollingSummary";
import { summarizeChapter } from "@/lib/chapter/summarize";
import { resolveChapterIntro } from "@/lib/chapter/chapterIntro";
import { shouldAutoCreateNextChapter } from "@/lib/chapter/autoChapter";
import {
  finalizeChapterPlotState,
  phaseHintForNextChapter,
} from "@/lib/chapter/finalizeChapter";
import { extractCharacterMemoryUpdates } from "@/lib/memory/characterMemory";
import { extractPlotState } from "@/lib/memory/plotState";
import type { StoryPlotState } from "@/lib/memory/plotState";
import type {
  ChatTurn,
  LoreEntry,
  StorySettings,
  VoiceMap,
  WryTourCharacter,
} from "@/lib/types";
import {
  appendTurn,
  applyCharacterMemoryUpdates,
  createNextChapter,
  getStoryBundle,
  getTurns,
  rebuildBandSummary,
  seedChapterIntro,
  touchStoryUpdated,
  updateChapterSummaries,
  updateChapterTitle,
  updateStorySettings,
  type ChapterRow,
  type CharacterRow,
  type TurnRow,
} from "@/lib/db/stories";
import { truncateTurnsFrom, updateTurnContent } from "@/lib/db/turns";
import { createClient } from "@/lib/supabase/client";
import { mergeVoiceMapForProvider } from "@/lib/tts/defaultVoiceMap";
import { isTtsReady, loadTtsSettings } from "@/lib/storage/ttsSettings";
import { subscribeServerCapabilities } from "@/lib/server/serverCapabilities";
import type { MessageAudioPlayerHandle } from "@/lib/tts/messageAudioPlayerHandle";
import { TtsAutoplayQueue } from "@/lib/tts/ttsAutoplayQueue";
import { saveTtsAutoplay } from "@/lib/storage/ttsPlaybackSettings";
import { ChatScrollPane } from "@/components/ChatScrollPane";
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
  chapterTitle,
  phaseHint,
  chapterIndex,
  closedChapterCount = 0,
  readOnly = false,
  storyLocale,
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
  chapterTitle?: string | null;
  phaseHint?: string | null;
  chapterIndex?: number;
  closedChapterCount?: number;
  readOnly?: boolean;
  storyLocale?: string;
}) {
  const ttsSettings = loadTtsSettings();
  const voiceMap: VoiceMap = mergeVoiceMapForProvider(
    ttsSettings.provider,
    storyLocale,
    storySettings.voiceMap,
  );
  const voiceEnabledSlugs = storySettings.voiceEnabledSlugs;

  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamDraft, setStreamDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loreCount, setLoreCount] = useState(0);
  const [rollingSummary, setRollingSummary] = useState(
    chapter.rolling_summary,
  );
  const [plotState, setPlotState] = useState<StoryPlotState | null>(
    storySettings.plotState ?? null,
  );
  const [allCast, setAllCast] = useState<CharacterRow[]>(
    cast.filter((c) => c.role === "cast"),
  );
  const [beatOptions, setBeatOptions] = useState<StoryBeatOption[] | null>(
    null,
  );
  const [beatsLoading, setBeatsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const beatsAbortRef = useRef<AbortController | null>(null);
  const autoPlayRemainingRef = useRef(0);
  const autoChapterBusyRef = useRef(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoTotal, setAutoTotal] = useState(0);
  const [autoSession, setAutoSession] = useState(false);
  const memorySyncRef = useRef(false);
  const initialPlotSyncDone = useRef(false);
  const knownTurnIdsRef = useRef<Set<string>>(new Set());
  const ttsBaselineReadyRef = useRef(false);
  const ttsQueueRef = useRef(new TtsAutoplayQueue());
  const [ttsAutoplay, setTtsAutoplay] = useState(false);
  const [hasTts, setHasTts] = useState(false);
  const [ttsQueueActive, setTtsQueueActive] = useState(false);
  const [ttsPlayingTurnId, setTtsPlayingTurnId] = useState<string | null>(null);
  const [ttsQueuedTurnIds, setTtsQueuedTurnIds] = useState<string[]>([]);
  const [copiedChatDebug, setCopiedChatDebug] = useState(false);
  const bubbleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [bubbleFocusIndex, setBubbleFocusIndex] = useState(0);
  const loadSeqRef = useRef(0);
  const prevTurnCountRef = useRef(0);
  const chatBusyRef = useRef(false);
  const ROLLING_EVERY_N_TURNS = 4;
  const PLOT_EVERY_N_TURNS = 2;

  useEffect(() => {
    const refreshTts = () => setHasTts(isTtsReady(loadTtsSettings()));
    setTtsAutoplay(readTtsAutoplayPreference());
    refreshTts();
    const unsubCaps = subscribeServerCapabilities(refreshTts);
    const queue = ttsQueueRef.current;
    const unsubActive = queue.subscribe(setTtsQueueActive);
    const unsubQueue = queue.subscribeQueue(setTtsQueuedTurnIds);
    return () => {
      unsubCaps();
      unsubActive();
      unsubQueue();
    };
  }, []);

  const registerTtsPlayer = useCallback(
    (turnId: string, player: MessageAudioPlayerHandle | null) => {
      ttsQueueRef.current.register(turnId, player);
    },
    [],
  );

  const assistantTurnIds = useMemo(
    () =>
      turns
        .filter(
          (t) => t.role === "assistant" && !t.id.startsWith("tmp-"),
        )
        .map((t) => t.id),
    [turns],
  );

  useEffect(() => {
    ttsQueueRef.current.setAssistantTurnOrder(assistantTurnIds);
  }, [assistantTurnIds]);

  const requestTtsChainPlay = useCallback(
    (turnId: string) => {
      if (!hasTts || !ttsAutoplay) return;
      ttsQueueRef.current.playFrom(turnId, assistantTurnIds);
    },
    [hasTts, ttsAutoplay, assistantTurnIds],
  );

  const handleTtsPlaybackChange = useCallback(
    (turnId: string, active: boolean) => {
      setTtsPlayingTurnId((prev) => {
        if (active) return turnId;
        return prev === turnId ? null : prev;
      });
    },
    [],
  );

  const enqueueNewAssistantTts = useCallback(
    (rows: TurnRow[], force = false) => {
      if ((!ttsAutoplay && !force) || !hasTts || !ttsBaselineReadyRef.current) {
        return;
      }
      const prev = knownTurnIdsRef.current;
      const fresh = rows
        .filter(
          (t) =>
            t.role === "assistant" &&
            !t.id.startsWith("tmp-") &&
            !prev.has(t.id),
        )
        .sort((a, b) => a.index_in_chapter - b.index_in_chapter);
      if (!fresh.length) return;
      ttsQueueRef.current.enqueue(fresh.map((t) => t.id));
    },
    [ttsAutoplay, hasTts],
  );

  const syncKnownTurns = useCallback((rows: TurnRow[]) => {
    knownTurnIdsRef.current = new Set(rows.map((t) => t.id));
  }, []);

  const stopTtsAutoplay = useCallback(() => {
    ttsQueueRef.current.stop();
    setTtsQueueActive(false);
    setTtsQueuedTurnIds([]);
  }, []);

  const load = useCallback(async () => {
    if (chatBusyRef.current) return;
    const seq = ++loadSeqRef.current;
    const rows = await getTurns(chapterId);
    if (seq !== loadSeqRef.current || chatBusyRef.current) return;
    syncKnownTurns(rows);
    ttsBaselineReadyRef.current = true;
    setTurns(rows);
  }, [chapterId, syncKnownTurns]);

  useEffect(() => {
    if (!turns.length) return;
    prefetchDialogueAttributionBatch(turns, allCast);
  }, [turns, allCast]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  useEffect(() => {
    setBubbleFocusIndex(Math.max(0, turns.length - 1));
  }, [chapterId]);

  useEffect(() => {
    if (turns.length > prevTurnCountRef.current) {
      setBubbleFocusIndex(turns.length - 1);
    }
    prevTurnCountRef.current = turns.length;
  }, [turns]);

  const scrollToBubbleIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, turns.length - 1));
      const turn = turns[clamped];
      if (!turn) return;
      setBubbleFocusIndex(clamped);
      const el = bubbleRefs.current.get(turn.id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [turns],
  );

  useEffect(() => {
    setRollingSummary(chapter.rolling_summary);
  }, [chapter.id, chapter.rolling_summary]);

  useEffect(() => {
    setPlotState(storySettings.plotState ?? null);
  }, [storyId, storySettings.plotState]);

  useEffect(() => {
    setAllCast(cast.filter((c) => c.role === "cast"));
  }, [cast]);

  const syncStoryMemory = useCallback(
    async (
      rows: TurnRow[],
      existingPlot?: StoryPlotState | null,
    ): Promise<{
      rolling: string | null;
      plot: StoryPlotState | null;
      cast: CharacterRow[];
    } | null> => {
      if (readOnly || memorySyncRef.current) return null;
      const s = loadOpenRouterSettings();
      if (!s) return null;

      memorySyncRef.current = true;
      try {
        if (!rows.length) {
          setRollingSummary(null);
          setPlotState(null);
          await updateChapterSummaries(chapterId, { rolling_summary: "" });
          await updateStorySettings(storyId, { plotState: null });
          return { rolling: null, plot: null, cast: allCast };
        }

        const chat = turnsToChat(rows);
        const title = chapterTitle ?? chapter.title;
        const phase = phaseHint ?? chapter.phase_hint;
        const priorPlot = existingPlot !== undefined ? existingPlot : plotState;

        const [updatedRolling, updatedPlot] = await Promise.all([
          regenerateRollingSummary(s, chat, {
            chapterTitle: title,
            phaseHint: phase,
          }),
          extractPlotState(s, chat, priorPlot, {
            chapterTitle: title,
            phaseHint: phase,
          }),
        ]);

        let latestCast = allCast;
        const {
          data: { user },
        } = await createClient().auth.getUser();
        if (user) {
          const charUpdates = await extractCharacterMemoryUpdates(
            s,
            chat,
            allCast,
            { chapterTitle: title },
          );
          if (charUpdates.length) {
            latestCast = (
              await applyCharacterMemoryUpdates(
                storyId,
                user.id,
                charUpdates,
                chapterId,
              )
            ).filter((c) => c.role === "cast");
            setAllCast(latestCast);
          }
        }

        setRollingSummary(updatedRolling);
        setPlotState(updatedPlot);
        await updateChapterSummaries(chapterId, {
          rolling_summary: updatedRolling,
        });
        await updateStorySettings(storyId, { plotState: updatedPlot });
        return {
          rolling: updatedRolling,
          plot: updatedPlot,
          cast: latestCast,
        };
      } catch (e) {
        console.warn("Story memory sync failed:", e);
        return null;
      } finally {
        memorySyncRef.current = false;
      }
    },
    [
      readOnly,
      chapterId,
      storyId,
      chapter.title,
      chapter.phase_hint,
      chapterTitle,
      phaseHint,
      plotState,
      allCast,
    ],
  );

  const syncPlotStateOnly = useCallback(
    async (
      rows: TurnRow[],
      existingPlot?: StoryPlotState | null,
    ): Promise<StoryPlotState | null> => {
      if (readOnly || memorySyncRef.current) return null;
      const s = loadOpenRouterSettings();
      if (!s || !rows.length) return null;

      memorySyncRef.current = true;
      try {
        const chat = turnsToChat(rows);
        const title = chapterTitle ?? chapter.title;
        const phase = phaseHint ?? chapter.phase_hint;
        const priorPlot = existingPlot !== undefined ? existingPlot : plotState;

        const updatedPlot = await extractPlotState(s, chat, priorPlot, {
          chapterTitle: title,
          phaseHint: phase,
        });

        setPlotState(updatedPlot);
        await updateStorySettings(storyId, { plotState: updatedPlot });
        return updatedPlot;
      } catch (e) {
        console.warn("Plot state sync failed:", e);
        return null;
      } finally {
        memorySyncRef.current = false;
      }
    },
    [
      readOnly,
      storyId,
      chapter.title,
      chapter.phase_hint,
      chapterTitle,
      phaseHint,
      plotState,
    ],
  );

  useEffect(() => {
    if (
      initialPlotSyncDone.current ||
      readOnly ||
      turns.length < 2 ||
      plotState?.updatedAt
    ) {
      return;
    }
    initialPlotSyncDone.current = true;
    syncPlotStateOnly(turns).catch(() => {});
  }, [turns, readOnly, plotState?.updatedAt, syncPlotStateOnly]);

  const maybeSummarize = async (rows: TurnRow[]) => {
    if (rows.length <= 0) return;
    if (rows.length % ROLLING_EVERY_N_TURNS === 0) {
      await syncStoryMemory(rows);
      return;
    }
    if (rows.length % PLOT_EVERY_N_TURNS === 0) {
      await syncPlotStateOnly(rows);
    }
  };

  const maybeAutoCreateChapter = useCallback(
    async (rows: TurnRow[]) => {
      if (readOnly || autoChapterBusyRef.current) return false;
      if (!shouldAutoCreateNextChapter(rows)) return false;

      const settings = loadOpenRouterSettings();
      if (!settings) return false;
      autoChapterBusyRef.current = true;
      setStreaming(true);
      setError(null);

      try {
        const bundle = await getStoryBundle(storyId, chapterId);
        if (bundle.activeChapter.id !== chapterId) return false;

        const currentTitle = (chapterTitle ?? chapter.title).trim();
        if (currentTitle) {
          await updateChapterTitle(chapterId, currentTitle);
        }

        const plot = await finalizeChapterPlotState({
          settings,
          storyId,
          rows,
          chapterTitle: currentTitle,
          phaseHint: phaseHint ?? chapter.phase_hint,
          existingPlot: plotState,
        });
        const nextPhaseHint = phaseHintForNextChapter(
          plot,
          phaseHint ?? chapter.phase_hint,
        );

        const chatTurns: ChatTurn[] = rows.map((t) => ({
          role: t.role as ChatTurn["role"],
          content: t.content,
          speakerSlug: t.speaker_slug,
        }));

        const summary = await summarizeChapter(settings, chatTurns, currentTitle);
        await updateChapterSummaries(chapterId, {
          chapter_summary: summary,
          status: "closed",
          closed_at: new Date().toISOString(),
        });

        const nextIndex =
          Math.max(...bundle.chapters.map((c) => c.index_in_band), 0) + 1;
        const nextTitle = `Chapter ${nextIndex}`;

        const intro = await resolveChapterIntro("ai_bridge", {
          settings,
          priorTurns: rows,
          chapterSummary: summary,
          previousChapterTitle: currentTitle,
          nextChapterTitle: nextTitle,
          phaseHint: nextPhaseHint ?? null,
        });

        const newChapter = await createNextChapter(
          bundle.band.id as string,
          nextIndex,
          nextTitle,
          nextPhaseHint,
        );

        if (intro.turns.length) {
          await seedChapterIntro(newChapter.id, intro.turns, storyId);
        }

        const fresh = await getStoryBundle(storyId);
        await rebuildBandSummary(bundle.band.id as string, fresh.chapters, settings);
        await touchStoryUpdated(storyId);
        window.location.href = `/story/${storyId}/chat?chapter=${newChapter.id}`;
        return true;
      } catch (e) {
        console.warn("Auto chapter creation failed:", e);
        return false;
      } finally {
        autoChapterBusyRef.current = false;
        setStreaming(false);
      }
    },
    [readOnly, storyId, chapterId, chapterTitle, chapter.title, phaseHint, plotState],
  );

  const persistAssistantReply = async (
    full: string,
    startIndex: number,
    history: TurnRow[],
    forceTtsEnqueue = false,
  ) => {
    await truncateTurnsFrom(chapterId, startIndex, storyId);
    const blocks = parseAssistantBlocks(full);
    const inserted = await appendTurn(
      chapterId,
      startIndex,
      "assistant",
      blocks[0]?.content ?? full,
      storyId,
      blocks[0]?.speakerSlug ?? "narrator",
    );

    const base = history.filter((t) => t.index_in_chapter < startIndex);
    const merged = [...base, inserted].sort(
      (a, b) => a.index_in_chapter - b.index_in_chapter,
    );

    loadSeqRef.current++;
    syncKnownTurns(merged);
    setTurns(merged);

    const orSettings = loadOpenRouterSettings();
    if (orSettings) {
      void ensureDialogueAttribution(
        inserted.id,
        inserted.content,
        allCast,
        orSettings,
      ).catch(() => undefined);
    }

    void getTurns(chapterId)
      .then((fresh) => {
        if (chatBusyRef.current) return;
        if (fresh.length < merged.length) return;
        loadSeqRef.current++;
        syncKnownTurns(fresh);
        setTurns(fresh);
      })
      .catch(() => undefined);

    enqueueNewAssistantTts(merged, forceTtsEnqueue);

    await maybeSummarize(merged);
    await maybeAutoCreateChapter(merged);
  };

  const runGeneration = async (
    history: TurnRow[],
    opts: {
      continuation?: boolean;
      continuationPrompt?: string;
      plotState?: StoryPlotState | null;
      rollingSummary?: string | null;
      allCast?: CharacterRow[];
      forceTts?: boolean;
    } = {},
  ): Promise<boolean> => {
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setError("Add your OpenRouter API key in Settings first.");
      return false;
    }
    const chatSettings = resolveChatModelSettings(settings);

    setError(null);
    setStreamDraft("");
    chatBusyRef.current = true;
    setStreaming(true);
    abortRef.current = new AbortController();

    let full = "";
    try {
      full = await streamAssistantReply({
        settings: chatSettings,
        character,
        cast: opts.allCast ?? allCast,
        loreEntries,
        turns: turnsToChat(history),
        storySettings,
        bandSummary,
        chapterSummary: priorChapterSummaries,
        rollingSummary: opts.rollingSummary ?? rollingSummary,
        chapterTitle: chapterTitle ?? chapter.title,
        phaseHint: phaseHint ?? chapter.phase_hint,
        chapterIndex: chapterIndex ?? chapter.index_in_band,
        closedChapterCount,
        plotState: opts.plotState !== undefined ? opts.plotState : plotState,
        allCast: opts.allCast ?? allCast,
        continuation: opts.continuation,
        continuationPrompt: opts.continuationPrompt,
        onLoreCount: setLoreCount,
        onToken: (chunk) => setStreamDraft((prev) => prev + chunk),
        signal: abortRef.current.signal,
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(formatLlmLimitError(e instanceof Error ? e.message : String(e)));
      }
      abortRef.current = null;
      chatBusyRef.current = false;
      setStreaming(false);
      setStreamDraft("");
      return false;
    }

    const aborted = abortRef.current?.signal.aborted ?? false;
    abortRef.current = null;

    if (aborted) {
      chatBusyRef.current = false;
      setStreaming(false);
      setStreamDraft("");
      return false;
    }
    if (!full.trim()) {
      chatBusyRef.current = false;
      setStreaming(false);
      setStreamDraft("");
      setError("Leere Antwort vom Modell — bitte erneut versuchen.");
      return false;
    }

    const startIndex = nextTurnIndex(history);
    try {
      await persistAssistantReply(
        full,
        startIndex,
        history,
        opts.forceTts ?? false,
      );
    } catch (e) {
      setError(formatLlmLimitError(e instanceof Error ? e.message : String(e)));
      await load();
      chatBusyRef.current = false;
      setStreaming(false);
      setStreamDraft("");
      return false;
    }

    chatBusyRef.current = false;
    setStreaming(false);
    setStreamDraft("");
    return true;
  };

  const cancelWork = () => {
    autoPlayRemainingRef.current = 0;
    setAutoLeft(0);
    setAutoTotal(0);
    setAutoSession(false);
    stopTtsAutoplay();
    abortRef.current?.abort();
    beatsAbortRef.current?.abort();
    abortRef.current = null;
    beatsAbortRef.current = null;
    setStreaming(false);
    setStreamDraft("");
    setBeatsLoading(false);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming || autoSession || readOnly) return;

    setInput("");
    setError(null);

    try {
      const userIndex = nextTurnIndex(turns);
      const insertedUser = await appendTurn(
        chapterId,
        userIndex,
        "user",
        text,
        storyId,
      );
      const rowsAfterUser = [...turns, insertedUser].sort(
        (a, b) => a.index_in_chapter - b.index_in_chapter,
      );
      loadSeqRef.current++;
      syncKnownTurns(rowsAfterUser);
      setTurns(rowsAfterUser);
      await runGeneration(rowsAfterUser, {});
    } catch (e) {
      setError(formatLlmLimitError(e instanceof Error ? e.message : String(e)));
      await load();
    }
  };

  const promptCtx = () => ({
    character,
    loreEntries,
    turns: turnsToChat(turns),
    bandSummary,
    chapterSummary: priorChapterSummaries,
    rollingSummary,
    chapterTitle: chapterTitle ?? chapter.title,
    phaseHint: phaseHint ?? chapter.phase_hint,
    chapterIndex: chapterIndex ?? chapter.index_in_band,
    closedChapterCount,
    plotState,
    allCast,
    settings: storySettings,
  });

  const requestBeatSuggestions = async () => {
    if (streaming || autoSession || readOnly || !turns.length || beatsLoading)
      return;

    const settings = loadOpenRouterSettings();
    if (!settings) {
      setError("Add your OpenRouter API key in Settings first.");
      return;
    }
    const chatSettings = resolveChatModelSettings(settings);

    setError(null);
    setBeatsLoading(true);
    setBeatOptions(null);
    beatsAbortRef.current = new AbortController();

    try {
      const options = await fetchStoryBeatSuggestions({
        settings: chatSettings,
        promptCtx: promptCtx(),
        signal: beatsAbortRef.current.signal,
      });
      setBeatOptions(options);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(formatLlmLimitError(e instanceof Error ? e.message : String(e)));
    } finally {
      beatsAbortRef.current = null;
      setBeatsLoading(false);
    }
  };

  const playChosenBeat = async (beat: StoryBeatOption) => {
    if (streaming || autoSession || readOnly) return;
    setBeatOptions(null);
    await runGeneration(turns, {
      continuation: true,
      continuationPrompt: buildPlayBeatPrompt(beat),
    });
  };

  const quickContinue = async () => {
    if (streaming || readOnly || autoSession || !turns.length) return;
    setBeatOptions(null);
    await runGeneration(turns, {
      continuation: true,
      continuationPrompt: defaultContinuePrompt(),
    });
  };

  const runDriveMode = async (minutes: DriveModeMinutes) => {
    if (streaming || readOnly || autoSession || !turns.length || !hasTts) return;

    setBeatOptions(null);
    setAutoSession(true);
    setAutoTotal(0);
    autoPlayRemainingRef.current = 0;
    setAutoLeft(0);

    const endAt = Date.now() + minutes * 60 * 1000;
    let history = turns;

    while (Date.now() < endAt) {
      const ok = await runGeneration(history, {
        continuation: true,
        continuationPrompt: autoContinuePrompt(),
        forceTts: true,
      });
      if (!ok) break;

      await ttsQueueRef.current.waitUntilIdle();

      history = await getTurns(chapterId);
      setTurns(history);
    }

    setAutoSession(false);
  };

  const runAutoPlay = async (total: AutoPlayTurnCount) => {
    if (streaming || readOnly || autoSession || !turns.length) return;

    setBeatOptions(null);
    setAutoSession(true);
    setAutoTotal(total);
    autoPlayRemainingRef.current = total;
    setAutoLeft(total);

    let history = turns;

    while (autoPlayRemainingRef.current > 0) {
      const ok = await runGeneration(history, {
        continuation: true,
        continuationPrompt: autoContinuePrompt(),
      });
      if (!ok || autoPlayRemainingRef.current === 0) break;

      history = await getTurns(chapterId);
      setTurns(history);

      autoPlayRemainingRef.current -= 1;
      setAutoLeft(autoPlayRemainingRef.current);
    }

    autoPlayRemainingRef.current = 0;
    setAutoLeft(0);
    setAutoTotal(0);
    setAutoSession(false);
  };

  const handleEdit = async (turnId: string, content: string) => {
    await updateTurnContent(turnId, content, storyId);
    const rows = await getTurns(chapterId);
    setTurns(rows);
    await syncStoryMemory(rows);
  };

  const handleRewind = async (turnId: string) => {
    const turn = turns.find((t) => t.id === turnId);
    if (!turn) return;
    const rows = await truncateTurnsFrom(
      chapterId,
      turn.index_in_chapter,
      storyId,
    );
    stopTtsAutoplay();
    syncKnownTurns(rows);
    setTurns(rows);
    if (streaming) abortRef.current?.abort();
    await syncStoryMemory(rows);
  };

  const handleReroll = async (turnId: string) => {
    const fromIdx = rerollDeleteFromIndex(turns, turnId);
    if (fromIdx === null) return;

    setError(null);
    stopTtsAutoplay();
    chatBusyRef.current = true;

    try {
      const rows = await truncateTurnsFrom(chapterId, fromIdx, storyId);
      loadSeqRef.current++;
      syncKnownTurns(rows);
      setTurns(rows);

      const endsOnUser = rows[rows.length - 1]?.role === "user";

      const ok = await runGeneration(rows, {
        continuation: true,
        continuationPrompt: rerollAssistantPrompt(endsOnUser),
      });

      if (!ok) {
        setError((prev) => prev ?? "Neugenerierung fehlgeschlagen.");
      }
    } catch (e) {
      setError(formatLlmLimitError(e instanceof Error ? e.message : String(e)));
      await load();
    } finally {
      chatBusyRef.current = false;
    }
  };

  const copyCurrentChatDebug = async () => {
    if (!turns.length) return;
    const header = [
      "# Chat Debug Export",
      `storyId: ${storyId}`,
      `chapterId: ${chapterId}`,
      `mode: storyteller`,
      `turnCount: ${turns.length}`,
      `exportedAt: ${new Date().toISOString()}`,
    ].join("\n");

    const body = turns
      .map((t, idx) => {
        const speaker =
          t.role === "assistant" ? (t.speaker_slug ?? "narrator") : t.role;
        const lines = [
          `--- TURN ${idx + 1} ---`,
          `id: ${t.id}`,
          `index_in_chapter: ${t.index_in_chapter}`,
          `role: ${t.role}`,
          `speaker: ${speaker}`,
          "content:",
          t.content,
        ];
        if (t.role === "assistant" && (t.speaker_slug ?? "narrator") === "narrator") {
          lines.push(formatScriptAttributionDebug(t.content, allCast));
        }
        return lines.join("\n");
      })
      .join("\n\n");

    const payload = `${header}\n\n${body}\n`;
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
      setCopiedChatDebug(true);
      setTimeout(() => setCopiedChatDebug(false), 1500);
    } catch {
      alert("Copy failed. Use browser copy as fallback.");
    }
  };

  const toolsActivity = useMemo(() => {
    if (streaming) {
      return {
        label:
          autoTotal > 0
            ? `Automatisch – noch ${autoLeft} von ${autoTotal} …`
            : ttsQueueActive
              ? "Geschichte wird geschrieben · TTS läuft …"
              : "Geschichte wird geschrieben …",
        onCancel: cancelWork,
      };
    }
    if (ttsQueueActive && !beatsLoading) {
      return {
        label: "TTS wird abgespielt …",
        onCancel: stopTtsAutoplay,
      };
    }
    if (beatsLoading) {
      return {
        label: "Vorschläge werden gedacht …",
        onCancel: cancelWork,
      };
    }
    return null;
  }, [
    streaming,
    autoTotal,
    autoLeft,
    ttsQueueActive,
    beatsLoading,
    cancelWork,
    stopTtsAutoplay,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <BubbleNavArrows
          count={turns.length}
          currentIndex={bubbleFocusIndex}
          onPrev={() => scrollToBubbleIndex(bubbleFocusIndex - 1)}
          onNext={() => scrollToBubbleIndex(bubbleFocusIndex + 1)}
        />
        <ChatScrollPane
          scrollRef={chatScrollRef}
          contentKey={`${turns.length}:${streaming}:${streamDraft.length}`}
        >
          {loreCount > 0 ? (
            <p className="mb-2 text-center text-xs text-zinc-500">
              {loreCount} lore entries active
            </p>
          ) : null}

          {turns.map((t, index) => (
            <div
              key={t.id}
              ref={(el) => {
                if (el) bubbleRefs.current.set(t.id, el);
                else bubbleRefs.current.delete(t.id);
              }}
              className="scroll-mt-3 scroll-mb-3"
            >
              <ChatTurnBubble
                turn={t}
                cast={allCast}
                voiceMap={voiceMap}
                voiceEnabledSlugs={voiceEnabledSlugs}
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
                registerTtsPlayer={hasTts ? registerTtsPlayer : undefined}
                ttsAutoplayChain={ttsAutoplay && hasTts}
                onTtsChainPlay={requestTtsChainPlay}
                ttsPlaying={ttsPlayingTurnId === t.id}
                ttsQueued={
                  ttsQueuedTurnIds.includes(t.id) && ttsPlayingTurnId !== t.id
                }
                onTtsPlaybackChange={handleTtsPlaybackChange}
                navFocused={bubbleFocusIndex === index}
                storyLocale={storyLocale}
                showDialogueMarkup
              />
            </div>
          ))}

          {streaming ? (
            <div
              ref={(el) => {
                if (el) bubbleRefs.current.set("__streaming__", el);
                else bubbleRefs.current.delete("__streaming__");
              }}
              className="scroll-mt-3 scroll-mb-3 opacity-90"
            >
              <ChatTurnBubble
                turn={{
                  id: "__streaming__",
                  chapter_id: chapterId,
                  index_in_chapter: turns.length,
                  role: "assistant",
                  content: streamDraft || "Erzähler schreibt …",
                  created_at: new Date().toISOString(),
                  speaker_slug: "narrator",
                }}
                cast={allCast}
                voiceMap={voiceMap}
                voiceEnabledSlugs={voiceEnabledSlugs}
                readOnly
                onEdit={async () => {}}
                onRewind={async () => {}}
                navFocused={false}
                storyLocale={storyLocale}
                showDialogueMarkup={false}
              />
            </div>
          ) : null}
        </ChatScrollPane>
      </div>

      {error ? (
        <p className="px-4 pb-2 text-center text-sm text-red-400">{error}</p>
      ) : null}

      <div className="safe-bottom border-t border-surface-border bg-surface px-3 py-3">
        <MobileCollapsibleTools
          title="TTS & Autoplay"
          hint={
            toolsActivity
              ? undefined
              : ttsQueueActive
                ? "TTS läuft"
                : ttsAutoplay
                  ? "Autoplay an"
                  : "Autoplay aus"
          }
          activityLabel={toolsActivity?.label}
          onActivityCancel={toolsActivity?.onCancel}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            {hasTts ? (
              <TtsAutoplayToggle
                enabled={ttsAutoplay}
                disabled={streaming || autoSession}
                queueActive={ttsQueueActive}
                onChange={(next) => {
                  setTtsAutoplay(next);
                  saveTtsAutoplay(next);
                  if (!next) stopTtsAutoplay();
                }}
              />
            ) : null}
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
            <button
              type="button"
              onClick={copyCurrentChatDebug}
              disabled={turns.length === 0}
              className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-400 disabled:opacity-40"
              title="Copy full current chat with role/speaker debug metadata"
            >
              {copiedChatDebug ? "Chat copied" : "Copy full chat"}
            </button>
          </div>
          {!readOnly ? (
            <AutoPlayControls
              disabled={streaming || autoSession || turns.length === 0}
              onStart={runAutoPlay}
              onDriveStart={hasTts ? runDriveMode : undefined}
            />
          ) : null}
        </MobileCollapsibleTools>

        {!readOnly ? (
          <>
            <StoryBeatPicker
              disabled={streaming || autoSession || turns.length === 0}
              loading={beatsLoading}
              options={beatOptions}
              onRequestBeats={requestBeatSuggestions}
              onSelectBeat={playChosenBeat}
              onDismiss={requestBeatSuggestions}
              onQuickContinue={quickContinue}
            />
          </>
        ) : null}

        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={readOnly ? "Read-only chapter" : "What do you do?"}
            className="flex-1 resize-none rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base outline-none focus:border-accent"
            disabled={streaming || autoSession || readOnly}
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
            disabled={streaming || autoSession || readOnly || !input.trim()}
            className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

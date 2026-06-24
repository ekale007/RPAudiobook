"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AutoChapterOverlay,
  type AutoChapterOverlayPhase,
} from "@/components/AutoChapterOverlay";
import { GeneratingIndicator } from "@/components/GeneratingIndicator";
import { BubbleNavArrows } from "@/components/BubbleNavArrows";
import { ChatTurnBubble } from "@/components/ChatTurnBubble";
import { AutoPlayControls } from "@/components/AutoPlayControls";
import { formatLlmLimitError } from "@/components/LlmUsagePanel";
import { MobileCollapsibleTools } from "@/components/MobileCollapsibleTools";
import { ChatSteeringBar } from "@/components/ChatSteeringBar";
import { StoryBeatPicker } from "@/components/StoryBeatPicker";
import {
  formatSteeringReactionUserTurn,
  formatSteeringUserTurnContent,
  parseSteeringInput,
  stripSteeringTurnPrefix,
  type QuickReactionId,
  type SteeringInputMode,
} from "@/lib/chat/playerSteering";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import {
  readTtsAutoplayPreference,
  TtsAutoplayToggle,
} from "@/components/TtsAutoplayToggle";
import { TtsReadOnlyToggle } from "@/components/TtsReadOnlyToggle";
import {
  autoContinuePrompt,
  type AutoPlayTurnCount,
  type DriveModeMinutes,
} from "@/lib/chat/autoContinue";
import {
  ensureDialogueAttribution,
  prefetchDialogueAttributionBatch,
  turnNeedsDialogueAttribution,
} from "@/lib/chat/resolveDialogueAttribution";
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
import { ChapterProgressBar } from "@/components/ChapterProgressBar";
import {
  analyzeChapterCloudAudio,
  exportChapterAudioFromCloud,
} from "@/lib/audio/chapterAudioExport";
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
  StoryCharacterCard,
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
import {
  patchTurnCosts,
  truncateTurnsFrom,
  updateTurnContent,
} from "@/lib/db/turns";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { resolveStoryActorId } from "@/lib/story/useStorySession";
import { resolveStoryVoiceMap } from "@/lib/tts/defaultVoiceMap";
import { isTtsReady, loadTtsSettings } from "@/lib/storage/ttsSettings";
import { subscribeServerCapabilities } from "@/lib/server/serverCapabilities";
import type { MessageAudioPlayerHandle } from "@/lib/tts/messageAudioPlayerHandle";
import { TtsAutoplayQueue } from "@/lib/tts/ttsAutoplayQueue";
import { ttsPlayerWaitMs } from "@/lib/tts/mobilePlayback";
import {
  syncTtsReadOnlyFromStorage,
  unlockAudioForAutoplay,
  startAudioSession,
  stopAudioSession,
} from "@/lib/tts/audioUnlock";
import {
  clearTtsMediaSessionHandlers,
  setTtsMediaSessionControls,
} from "@/lib/tts/ttsMediaSession";
import {
  fetchTtsStorageQuota,
  type TtsStorageQuota,
} from "@/lib/tts/storeTurnAudioCloud";
import { TtsMobileUnlockBar } from "@/components/TtsMobileUnlockBar";
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
  character: StoryCharacterCard;
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
  const { t, locale } = useUiLocale();
  const ttsSettings = loadTtsSettings();
  const voiceMap: VoiceMap = resolveStoryVoiceMap(
    storySettings,
    ttsSettings.provider,
    storyLocale,
    {
      localEngine: ttsSettings.localEngine,
      falTtsModel: ttsSettings.falTtsModel,
    },
  );
  const voiceEnabledSlugs = storySettings.voiceEnabledSlugs;

  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [input, setInput] = useState("");
  const [inputExpanded, setInputExpanded] = useState(false);
  const [steeringInputMode, setSteeringInputMode] =
    useState<SteeringInputMode>("auto");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loreCount, setLoreCount] = useState(0);
  const [rollingSummary, setRollingSummary] = useState(
    chapter.rolling_summary,
  );
  const [plotState, setPlotState] = useState<StoryPlotState | null>(
    storySettings.plotState ?? null,
  );

  /** Live plot + Qwen profiles for TTS (scene instruct updates during play). */
  const ttsStorySettings = useMemo<StorySettings>(
    () => ({
      ...storySettings,
      plotState: plotState ?? storySettings.plotState ?? null,
    }),
    [storySettings, plotState],
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
  const autoChapterDeferredRef = useRef<string | null>(null);
  const autoChapterPhaseRef = useRef<AutoChapterOverlayPhase | null>(null);
  const router = useRouter();
  const [autoChapterPhase, setAutoChapterPhase] =
    useState<AutoChapterOverlayPhase | null>(null);
  const [autoChapterStatus, setAutoChapterStatus] = useState<string | null>(
    null,
  );
  const [autoChapterRows, setAutoChapterRows] = useState<TurnRow[]>([]);
  const autoSessionRef = useRef(false);
  const autoSessionStopRef = useRef(false);
  const drivePausedRef = useRef(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoTotal, setAutoTotal] = useState(0);
  const [autoSession, setAutoSession] = useState(false);
  const [drivePaused, setDrivePaused] = useState(false);
  const [driveEndsAt, setDriveEndsAt] = useState<number | null>(null);

  useEffect(() => {
    autoSessionRef.current = autoSession;
  }, [autoSession]);

  useEffect(() => {
    autoChapterPhaseRef.current = autoChapterPhase;
  }, [autoChapterPhase]);

  useEffect(() => {
    setAutoChapterPhase(null);
    setAutoChapterStatus(null);
    setAutoChapterRows([]);
    if (
      autoChapterDeferredRef.current &&
      autoChapterDeferredRef.current !== chapterId
    ) {
      autoChapterDeferredRef.current = null;
    }
  }, [chapterId]);
  const memorySyncRef = useRef(false);
  const initialPlotSyncDone = useRef(false);
  const knownTurnIdsRef = useRef<Set<string>>(new Set());
  const ttsBaselineReadyRef = useRef(false);
  const ttsQueueRef = useRef(new TtsAutoplayQueue());
  const ttsPlayingTurnIdRef = useRef<string | null>(null);
  const [ttsAutoplay, setTtsAutoplay] = useState(false);
  const [ttsReadOnly, setTtsReadOnly] = useState(false);
  const [hasTts, setHasTts] = useState(false);
  const [ttsQueueActive, setTtsQueueActive] = useState(false);
  const [ttsPlayingTurnId, setTtsPlayingTurnId] = useState<string | null>(null);
  const [ttsQueuedTurnIds, setTtsQueuedTurnIds] = useState<string[]>([]);
  const [ttsBlockedTurnId, setTtsBlockedTurnId] = useState<string | null>(null);
  const [ttsCloudQuota, setTtsCloudQuota] = useState<TtsStorageQuota | null>(
    null,
  );
  const [copiedChatDebug, setCopiedChatDebug] = useState(false);
  const [chapterExportBusy, setChapterExportBusy] = useState(false);
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
    setTtsReadOnly(syncTtsReadOnlyFromStorage());
    refreshTts();
    const unsubCaps = subscribeServerCapabilities(refreshTts);
    const queue = ttsQueueRef.current;
    const unsubActive = queue.subscribe(setTtsQueueActive);
    const unsubQueue = queue.subscribeQueue(setTtsQueuedTurnIds);
    queue.setAutoplayBlockedHandler((turnId) => setTtsBlockedTurnId(turnId));
    queue.setAutoplayClearedHandler(() => setTtsBlockedTurnId(null));
    return () => {
      unsubCaps();
      unsubActive();
      unsubQueue();
      queue.setAutoplayBlockedHandler(null);
      queue.setAutoplayClearedHandler(null);
    };
  }, []);

  const refreshTtsCloudQuota = useCallback(() => {
    void fetchTtsStorageQuota().then(setTtsCloudQuota);
  }, []);

  useEffect(() => {
    if (!hasTts || !isSupabaseConfigured()) return;
    void resolveStoryActorId().then((userId) => {
      if (userId) refreshTtsCloudQuota();
    });
  }, [hasTts, refreshTtsCloudQuota]);

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

  const resumeBlockedTts = useCallback(() => {
    if (ttsReadOnly) return;
    unlockAudioForAutoplay();
    startAudioSession();
    const blocked = ttsBlockedTurnId;
    setTtsBlockedTurnId(null);
    if (blocked) {
      ttsQueueRef.current.playFrom(blocked, assistantTurnIds);
    }
  }, [ttsBlockedTurnId, assistantTurnIds, ttsReadOnly]);

  const requestTtsChainPlay = useCallback(
    (turnId: string) => {
      if (!hasTts || !ttsAutoplay || ttsReadOnly) return;
      unlockAudioForAutoplay();
      ttsQueueRef.current.playFrom(turnId, assistantTurnIds);
    },
    [hasTts, ttsAutoplay, ttsReadOnly, assistantTurnIds],
  );

  const handleTtsPlaybackChange = useCallback(
    (turnId: string, active: boolean) => {
      setTtsPlayingTurnId((prev) => {
        const next = active ? turnId : prev === turnId ? null : prev;
        ttsPlayingTurnIdRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!hasTts) {
      setTtsMediaSessionControls(null);
      return;
    }
    setTtsMediaSessionControls({
      onPause: () => ttsQueueRef.current.pauseActive(),
      onPlay: () => ttsQueueRef.current.resumeActiveIfPaused(),
      onNext: () => ttsQueueRef.current.skipToNext(),
    });
    return () => {
      setTtsMediaSessionControls(null);
      clearTtsMediaSessionHandlers();
    };
  }, [hasTts]);

  useEffect(() => {
    if (!hasTts) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        ttsQueueRef.current.stabilizeOnForeground();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [hasTts]);

  const enqueueNewAssistantTts = useCallback(
    (rows: TurnRow[], force = false) => {
      if (autoSessionRef.current && !force) return;
      if (
        ttsReadOnly ||
        (!ttsAutoplay && !force) ||
        !hasTts ||
        !ttsBaselineReadyRef.current
      ) {
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
    [ttsAutoplay, ttsReadOnly, hasTts],
  );

  const syncKnownTurns = useCallback((rows: TurnRow[]) => {
    knownTurnIdsRef.current = new Set(rows.map((t) => t.id));
  }, []);

  const stopTtsAutoplay = useCallback(() => {
    ttsQueueRef.current.stop();
    setTtsQueueActive(false);
    setTtsQueuedTurnIds([]);
    stopAudioSession();
  }, []);

  const ensureTtsAutoplayForSession = useCallback(() => {
    if (ttsReadOnly) return;
    startAudioSession();
    unlockAudioForAutoplay();
    if (!ttsAutoplay) {
      setTtsAutoplay(true);
      saveTtsAutoplay(true);
    }
  }, [ttsAutoplay, ttsReadOnly]);

  const waitForLatestAssistantTts = useCallback(
    async (history: TurnRow[], options?: { forDrive?: boolean }) => {
      const assistants = history.filter(
        (t) => t.role === "assistant" && !t.id.startsWith("tmp-"),
      );
      const latest = assistants[assistants.length - 1];
      if (!latest) return "ok" as const;
      if (ttsReadOnly) return "ok" as const;

      unlockAudioForAutoplay();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      ttsQueueRef.current.setAssistantTurnOrder(assistants.map((t) => t.id));
      if (!options?.forDrive) {
        ttsQueueRef.current.stop();
      }
      return options?.forDrive
        ? ttsQueueRef.current.playTurnForDrive(latest.id)
        : ttsQueueRef.current.playTurnAndWaitForDrive(latest.id);
    },
    [ttsReadOnly],
  );

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
    prefetchDialogueAttributionBatch(turns, allCast, {
      locale: storyLocale,
      protagonist: storySettings.protagonist,
    });
  }, [turns, allCast, storyLocale, storySettings.protagonist]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  useEffect(() => {
    setBubbleFocusIndex(Math.max(0, turns.length - 1));
  }, [chapterId, turns.length]);

  useEffect(() => {
    if (turns.length > prevTurnCountRef.current) {
      const last = turns[turns.length - 1];
      if (last?.role === "user" && hasTts) {
        setBubbleFocusIndex(Math.max(0, turns.length - 2));
      } else {
        setBubbleFocusIndex(turns.length - 1);
      }
    }
    prevTurnCountRef.current = turns.length;
  }, [turns, hasTts]);

  const scrollToBubbleIndex = useCallback(
    (index: number, options?: { focus?: boolean }) => {
      const clamped = Math.max(0, Math.min(index, turns.length - 1));
      const turn = turns[clamped];
      if (!turn) return;
      if (options?.focus !== false) setBubbleFocusIndex(clamped);
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
        const userId = await resolveStoryActorId();
        if (userId) {
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
                userId,
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

  const executeAutoChapterClose = useCallback(
    async (rows: TurnRow[]) => {
      const settings = loadOpenRouterSettings();
      if (!settings) {
        setError(t("chat.openRouterKey"));
        setAutoChapterPhase(null);
        return false;
      }

      autoChapterBusyRef.current = true;
      setAutoChapterPhase("running");
      setGenerating(true);
      setError(null);

      try {
        const bundle = await getStoryBundle(storyId, chapterId);
        if (bundle.activeChapter.id !== chapterId) return false;

        const currentTitle = (chapterTitle ?? chapter.title).trim();
        if (currentTitle) {
          await updateChapterTitle(chapterId, currentTitle);
        }

        setAutoChapterStatus(t("chat.plotSaving"));
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

        setAutoChapterStatus(t("chat.chapterSummarizing"));
        const summary = await summarizeChapter(settings, chatTurns, currentTitle);
        await updateChapterSummaries(chapterId, {
          chapter_summary: summary,
          status: "closed",
          closed_at: new Date().toISOString(),
        });

        const nextIndex =
          Math.max(...bundle.chapters.map((c) => c.index_in_band), 0) + 1;
        const nextTitle = `Chapter ${nextIndex}`;

        setAutoChapterStatus(t("chat.introWriting"));
        const intro = await resolveChapterIntro("ai_bridge", {
          settings,
          priorTurns: rows,
          chapterSummary: summary,
          previousChapterTitle: currentTitle,
          nextChapterTitle: nextTitle,
          phaseHint: nextPhaseHint ?? null,
        });

        setAutoChapterStatus(t("chat.nextChapterStarting"));
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
        setError(
          e instanceof Error ? e.message : t("chat.chapterTransitionFailed"),
        );
        setAutoChapterPhase(null);
        return false;
      } finally {
        autoChapterBusyRef.current = false;
        setGenerating(false);
        setAutoChapterStatus(null);
      }
    },
    [
      storyId,
      chapterId,
      chapterTitle,
      chapter.title,
      chapter.phase_hint,
      phaseHint,
      plotState,
    ],
  );

  const maybeAutoCreateChapter = useCallback(
    async (rows: TurnRow[]) => {
      if (readOnly || autoChapterBusyRef.current) return false;
      if (!shouldAutoCreateNextChapter(rows)) return false;
      if (autoChapterDeferredRef.current === chapterId) return false;
      if (autoChapterPhaseRef.current) return false;

      setAutoChapterRows(rows);
      setAutoChapterPhase("prompt");
      return false;
    },
    [readOnly, chapterId],
  );

  const dismissAutoChapterPrompt = useCallback(() => {
    autoChapterDeferredRef.current = chapterId;
    setAutoChapterPhase(null);
    setAutoChapterRows([]);
  }, [chapterId]);

  const openManualChapterTransition = useCallback(() => {
    autoChapterDeferredRef.current = chapterId;
    setAutoChapterPhase(null);
    setAutoChapterRows([]);
    router.push(`/story/${storyId}/chapter`);
  }, [chapterId, router, storyId]);

  const persistAssistantReply = async (
    full: string,
    startIndex: number,
    history: TurnRow[],
    forceTtsEnqueue = false,
    skipTtsEnqueue = false,
    llmCostCents?: number,
    steeringMeta?: {
      display?: string | null;
      dialogueLine?: string | null;
      dialogueLines?: string[] | null;
    },
  ) => {
    await truncateTurnsFrom(chapterId, startIndex, storyId);
    const blocks = parseAssistantBlocks(full, {
      steeringDisplay: steeringMeta?.display,
      steeringDialogueLine: steeringMeta?.dialogueLine,
      steeringDialogueLines: steeringMeta?.dialogueLines,
      storyLocale,
    });
    const inserted = await appendTurn(
      chapterId,
      startIndex,
      "assistant",
      blocks[0]?.content ?? full,
      storyId,
      blocks[0]?.speakerSlug ?? "narrator",
      llmCostCents != null && llmCostCents > 0
        ? { llmCostCents }
        : undefined,
    );

    const base = history.filter((t) => t.index_in_chapter < startIndex);
    const merged = [...base, inserted].sort(
      (a, b) => a.index_in_chapter - b.index_in_chapter,
    );

    loadSeqRef.current++;
    setTurns(merged);

    const orSettings = loadOpenRouterSettings();
    const attributionOpts = {
      locale: storyLocale,
      protagonist: storySettings.protagonist,
    };
    if (
      orSettings &&
      turnNeedsDialogueAttribution(inserted.content, storyLocale)
    ) {
      await ensureDialogueAttribution(
        inserted.id,
        inserted.content,
        allCast,
        orSettings,
        attributionOpts,
      ).catch(() => undefined);
    } else if (orSettings) {
      void ensureDialogueAttribution(
        inserted.id,
        inserted.content,
        allCast,
        orSettings,
        attributionOpts,
      ).catch(() => undefined);
    }

    void getTurns(chapterId)
      .then((fresh) => {
        if (chatBusyRef.current) return;
        if (fresh.length < merged.length) return;
        loadSeqRef.current++;
        setTurns(fresh);
        syncKnownTurns(fresh);
      })
      .catch(() => undefined);

    if (!skipTtsEnqueue) {
      enqueueNewAssistantTts(merged, forceTtsEnqueue);
    }
    syncKnownTurns(merged);

    void maybeSummarize(merged).catch((e) =>
      console.warn("Rolling summary (background) failed:", e),
    );
    void maybeAutoCreateChapter(merged).catch((e) =>
      console.warn("Auto chapter (background) failed:", e),
    );
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
      /** Prefetch during drive/autoplay — no full-screen generating indicator. */
      background?: boolean;
      /** Erzähler macht weiter / N× — keine TTS-Warteschlange, Autoplay nicht an. */
      suppressTts?: boolean;
      /** Last steering bubble text — repair protagonist line in reply. */
      steeringDisplay?: string | null;
      steeringDialogueLine?: string | null;
      steeringDialogueLines?: string[] | null;
    } = {},
  ): Promise<boolean> => {
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setError(t("chat.openRouterKeyShort"));
      return false;
    }
    const chatSettings = resolveChatModelSettings(settings);

    setError(null);
    chatBusyRef.current = true;
    if (!opts.background) setGenerating(true);
    abortRef.current = new AbortController();

    let full = "";
    let llmCostCents: number | undefined;
    try {
      const reply = await streamAssistantReply({
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
        storyLocale,
        onLoreCount: setLoreCount,
        signal: abortRef.current.signal,
      });
      full = reply.content;
      llmCostCents = reply.llmCostCents;
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(formatLlmLimitError(e instanceof Error ? e.message : String(e), locale));
      }
      abortRef.current = null;
      chatBusyRef.current = false;
      if (!opts.background) setGenerating(false);
      return false;
    }

    const aborted = abortRef.current?.signal.aborted ?? false;
    abortRef.current = null;

    if (aborted) {
      chatBusyRef.current = false;
      if (!opts.background) setGenerating(false);
      return false;
    }
    if (!full.trim()) {
      chatBusyRef.current = false;
      if (!opts.background) setGenerating(false);
      setError(t("chat.emptyModelReply"));
      return false;
    }

    const startIndex = nextTurnIndex(history);
    try {
      await persistAssistantReply(
        full,
        startIndex,
        history,
        opts.forceTts ?? false,
        opts.suppressTts ?? false,
        llmCostCents,
        {
          display: opts.steeringDisplay,
          dialogueLine: opts.steeringDialogueLine,
          dialogueLines: opts.steeringDialogueLines,
        },
      );
    } catch (e) {
      setError(formatLlmLimitError(e instanceof Error ? e.message : String(e), locale));
      await load();
      chatBusyRef.current = false;
      if (!opts.background) setGenerating(false);
      return false;
    }

    chatBusyRef.current = false;
    if (!opts.background) setGenerating(false);
    return true;
  };

  const cancelWork = useCallback(() => {
    autoSessionStopRef.current = true;
    drivePausedRef.current = false;
    setDrivePaused(false);
    setDriveEndsAt(null);
    autoPlayRemainingRef.current = 0;
    setAutoLeft(0);
    setAutoTotal(0);
    setAutoSession(false);
    stopTtsAutoplay();
    abortRef.current?.abort();
    beatsAbortRef.current?.abort();
    abortRef.current = null;
    beatsAbortRef.current = null;
    setGenerating(false);
    setBeatsLoading(false);
  }, [stopTtsAutoplay]);

  const cancelAutoSession = useCallback(() => {
    cancelWork();
  }, [cancelWork]);

  const pauseDriveMode = useCallback(() => {
    drivePausedRef.current = true;
    setDrivePaused(true);
    stopTtsAutoplay();
  }, [stopTtsAutoplay]);

  const resumeDriveMode = useCallback(() => {
    drivePausedRef.current = false;
    setDrivePaused(false);
  }, []);

  const waitWhileDrivePaused = useCallback(async () => {
    while (drivePausedRef.current && !autoSessionStopRef.current) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 250);
      });
    }
  }, []);

  const steeringMode = hasTts && !readOnly;

  const appendSteeringUserTurn = async (
    base: TurnRow[],
    displayContent: string,
  ): Promise<TurnRow[]> => {
    const userIndex = nextTurnIndex(base);
    const insertedUser = await appendTurn(
      chapterId,
      userIndex,
      "user",
      displayContent,
      storyId,
    );
    const rows = [...base, insertedUser].sort(
      (a, b) => a.index_in_chapter - b.index_in_chapter,
    );
    loadSeqRef.current++;
    syncKnownTurns(rows);
    setTurns(rows);
    return rows;
  };

  const sendSteering = async (
    userTurnContent: string,
    opts?: {
      suppressTts?: boolean;
      steeringDisplay?: string;
      steeringDialogueLine?: string;
      steeringDialogueLines?: string[];
    },
  ) => {
    if (generating || autoSession || readOnly || !turns.length) return;
    setBeatOptions(null);
    setError(null);
    let history = turns;
    try {
      history = await appendSteeringUserTurn(turns, userTurnContent);
    } catch (e) {
      setError(formatLlmLimitError(e instanceof Error ? e.message : String(e), locale));
      setGenerating(false);
      await load();
      return;
    }
    await runGeneration(history, {
      continuation: true,
      suppressTts: opts?.suppressTts,
      steeringDisplay:
        (opts?.steeringDisplay ??
          stripSteeringTurnPrefix(userTurnContent).trim()) || null,
      steeringDialogueLine: opts?.steeringDialogueLine ?? null,
      steeringDialogueLines: opts?.steeringDialogueLines ?? null,
    });
  };

  const sendQuickReaction = async (reaction: QuickReactionId) => {
    if (generating || autoSession || readOnly || !turns.length) return;
    await sendSteering(formatSteeringReactionUserTurn(reaction, storyLocale));
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || generating || autoSession || readOnly) return;

    setInput("");
    setInputExpanded(false);
    setError(null);

    if (steeringMode) {
      const parsed = parseSteeringInput(text, steeringInputMode, storyLocale);
      if (!parsed) return;
      const bubble = formatSteeringUserTurnContent(parsed.display);
      await sendSteering(bubble, {
        steeringDisplay: parsed.display,
        steeringDialogueLine: parsed.dialogueLines[0],
        steeringDialogueLines: parsed.dialogueLines,
      });
      setSteeringInputMode("auto");
      return;
    }

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
      setError(formatLlmLimitError(e instanceof Error ? e.message : String(e), locale));
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
    storyLocale,
  });

  const requestBeatSuggestions = async () => {
    if (generating || autoSession || readOnly || !turns.length || beatsLoading)
      return;

    const settings = loadOpenRouterSettings();
    if (!settings) {
      setError(t("chat.openRouterKeyShort"));
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
        storyLocale,
        signal: beatsAbortRef.current.signal,
      });
      setBeatOptions(options);
      setInputExpanded(true);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(formatLlmLimitError(e instanceof Error ? e.message : String(e), locale));
    } finally {
      beatsAbortRef.current = null;
      setBeatsLoading(false);
    }
  };

  useEffect(() => {
    if (beatOptions?.length || beatsLoading) {
      setInputExpanded(true);
    }
  }, [beatOptions, beatsLoading]);

  const playChosenBeat = async (beat: StoryBeatOption) => {
    if (generating || autoSession || readOnly) return;
    setBeatOptions(null);
    await runGeneration(turns, {
      continuation: true,
      continuationPrompt: buildPlayBeatPrompt(beat),
    });
  };

  const quickContinue = async () => {
    if (generating || readOnly || autoSession || !turns.length) return;
    setBeatOptions(null);
    await runGeneration(turns, {
      continuation: true,
      continuationPrompt: defaultContinuePrompt(),
      suppressTts: true,
    });
  };

  type DrivePrefetchResult = { ok: boolean; history: TurnRow[] };

  const prewarmDriveTtsAwait = async (history: TurnRow[]) => {
    const assistants = history.filter(
      (t) => t.role === "assistant" && !t.id.startsWith("tmp-"),
    );
    const latest = assistants[assistants.length - 1];
    if (!latest) return;

    ttsQueueRef.current.setAssistantTurnOrder(assistants.map((t) => t.id));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    await ttsQueueRef.current.prepareTurn(latest.id, {
      playerWaitMs: ttsPlayerWaitMs({ forDrive: true }),
    });
  };

  /** LLM + TTS buffer for the next scene (runs during current playback). */
  const prefetchDriveTurn = async (
    base: TurnRow[],
  ): Promise<DrivePrefetchResult> => {
    const llm = await prefetchDriveLlm(base);
    if (!llm.ok) return llm;
    await prewarmDriveTtsAwait(llm.history);
    return llm;
  };

  /** LLM only — used internally by prefetchDriveTurn. */
  const prefetchDriveLlm = async (
    base: TurnRow[],
  ): Promise<DrivePrefetchResult> => {
    const ok = await runGeneration(base, {
      continuation: true,
      continuationPrompt: autoContinuePrompt(),
      background: true,
    });
    if (!ok) return { ok: false, history: base };

    const history = await getTurns(chapterId);
    setTurns(history);
    return { ok: true, history };
  };

  const handleDriveTtsResult = (
    ttsResult: "ok" | "no-player" | "blocked" | "error",
  ): boolean => {
    if (ttsResult === "blocked") {
      setError(
        t("chat.driveBlocked"),
      );
      return false;
    }
    if (ttsResult === "no-player") {
      setError(
        t("chat.driveNoPlayer"),
      );
      return false;
    }
    if (ttsResult === "error") {
      setError(t("chat.driveTtsFailed"));
      return false;
    }
    return true;
  };

  const runDriveMode = async (minutes: DriveModeMinutes) => {
    if (
      generating ||
      readOnly ||
      ttsReadOnly ||
      autoSession ||
      !turns.length ||
      !hasTts
    )
      return;

    ensureTtsAutoplayForSession();
    setBeatOptions(null);
    autoSessionStopRef.current = false;
    drivePausedRef.current = false;
    setDrivePaused(false);
    setAutoSession(true);
    setAutoTotal(0);
    autoPlayRemainingRef.current = 0;
    setAutoLeft(0);
    setError(null);

    const endAt = Date.now() + minutes * 60 * 1000;
    setDriveEndsAt(endAt);
    let history = turns;
    let prefetched: Promise<DrivePrefetchResult> | null = null;

    try {
      while (Date.now() < endAt && !autoSessionStopRef.current) {
        await waitWhileDrivePaused();
        if (autoSessionStopRef.current) break;

        if (prefetched) {
          const result = await prefetched;
          prefetched = null;
          if (!result.ok || autoSessionStopRef.current) break;
          history = result.history;
        } else {
          const ok = await runGeneration(history, {
            continuation: true,
            continuationPrompt: autoContinuePrompt(),
          });
          if (!ok || autoSessionStopRef.current) break;
          history = await getTurns(chapterId);
          setTurns(history);
          await prewarmDriveTtsAwait(history);
        }

        if (autoSessionStopRef.current) break;
        await waitWhileDrivePaused();
        if (autoSessionStopRef.current) break;

        if (Date.now() < endAt && !autoSessionStopRef.current) {
          prefetched = prefetchDriveTurn(history);
        }

        const ttsResult = await waitForLatestAssistantTts(history, {
          forDrive: true,
        });
        if (autoSessionStopRef.current) break;
        if (!handleDriveTtsResult(ttsResult)) break;

        await waitWhileDrivePaused();
      }
    } finally {
      autoSessionStopRef.current = false;
      drivePausedRef.current = false;
      setDrivePaused(false);
      setDriveEndsAt(null);
      setAutoSession(false);
      stopAudioSession();
    }
  };

  /** 2× / 3× / 5× — nur weitere Erzähler-Blasen, ohne TTS oder Autoplay-Toggle. */
  const runMultiContinue = async (total: AutoPlayTurnCount) => {
    if (generating || readOnly || autoSession || !turns.length) return;

    setBeatOptions(null);
    setAutoSession(true);
    setAutoTotal(total);
    autoPlayRemainingRef.current = total;
    setAutoLeft(total);

    let history = turns;

    autoSessionStopRef.current = false;

    try {
      while (
        autoPlayRemainingRef.current > 0 &&
        !autoSessionStopRef.current
      ) {
        const ok = await runGeneration(history, {
          continuation: true,
          continuationPrompt: defaultContinuePrompt(),
          suppressTts: true,
          background: autoPlayRemainingRef.current < total,
        });
        if (!ok) break;
        history = await getTurns(chapterId);
        setTurns(history);
        autoPlayRemainingRef.current -= 1;
        setAutoLeft(autoPlayRemainingRef.current);
      }
    } finally {
      autoSessionStopRef.current = false;
      autoPlayRemainingRef.current = 0;
      setAutoLeft(0);
      setAutoTotal(0);
      setAutoSession(false);
    }
  };

  const handleEdit = async (turnId: string, content: string) => {
    await updateTurnContent(turnId, content, storyId);
    const rows = await getTurns(chapterId);
    setTurns(rows);
    await syncStoryMemory(rows);
  };

  const handleTurnTtsCost = useCallback(
    async (turnId: string, ttsCostCents: number) => {
      if (ttsCostCents <= 0 || turnId.startsWith("tmp-")) return;
      try {
        await patchTurnCosts(turnId, { ttsCostCents }, storyId);
      } catch {
        return;
      }
      setTurns((prev) =>
        prev.map((row) =>
          row.id === turnId ? { ...row, tts_cost_cents: ttsCostCents } : row,
        ),
      );
    },
    [storyId],
  );

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
    if (generating) abortRef.current?.abort();
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
        setError((prev) => prev ?? t("chat.rerollFailed"));
      }
    } catch (e) {
      setError(formatLlmLimitError(e instanceof Error ? e.message : String(e), locale));
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
      alert(t("chat.copyChatFailed"));
    }
  };

  const toolsActivity = useMemo(() => {
    const isDriveSession = autoSession && autoTotal === 0;
    const driveMinutesLeft =
      driveEndsAt != null
        ? Math.max(0, Math.ceil((driveEndsAt - Date.now()) / 60_000))
        : null;
    const driveTimeSuffix =
      driveMinutesLeft != null && driveMinutesLeft > 0
        ? t("chat.driveMinutesLeft", { minutes: String(driveMinutesLeft) })
        : "";
    const driveBaseLabel = drivePaused
      ? t("chat.drivePaused", { suffix: driveTimeSuffix })
      : t("chat.driveMode", { suffix: driveTimeSuffix });
    const driveControls = isDriveSession
      ? {
          onCancel: cancelAutoSession,
          onPause: drivePaused ? resumeDriveMode : pauseDriveMode,
          pauseLabel: drivePaused ? t("chat.resume") : t("chat.pause"),
        }
      : {};

    if (autoChapterPhase === "running") {
      return {
        label: autoChapterStatus ?? t("chat.chapterTransition"),
        onCancel: undefined,
        onPause: undefined,
        pauseLabel: undefined,
      };
    }
    if (autoChapterPhase === "prompt") {
      return {
        label: t("chat.chapterDecision"),
        onCancel: undefined,
        onPause: undefined,
        pauseLabel: undefined,
      };
    }
    if (generating) {
      return {
        label:
          autoTotal > 0
            ? t("chat.narratorWriting", {
                left: String(autoLeft),
                total: String(autoTotal),
              })
            : isDriveSession
              ? t("chat.driveWriting", { label: driveBaseLabel })
              : ttsQueueActive
                ? t("chat.writingWithTts")
                : t("chat.writing"),
        onCancel: isDriveSession ? cancelAutoSession : cancelWork,
        ...driveControls,
      };
    }
    if (ttsQueueActive && !beatsLoading) {
      return {
        label: isDriveSession
          ? t("chat.driveReading", { label: driveBaseLabel })
          : t("chat.ttsPlayingStatus"),
        onCancel: isDriveSession ? cancelAutoSession : stopTtsAutoplay,
        ...driveControls,
      };
    }
    if (isDriveSession) {
      return {
        label: driveBaseLabel,
        onCancel: cancelAutoSession,
        ...driveControls,
      };
    }
    if (autoSession && autoTotal > 0) {
      return {
        label: t("chat.narratorSeries", {
          left: String(autoLeft),
          total: String(autoTotal),
        }),
        onCancel: cancelAutoSession,
      };
    }
    if (beatsLoading) {
      return {
        label: t("chat.beatsLoading"),
        onCancel: cancelWork,
      };
    }
    return null;
  }, [
    generating,
    autoSession,
    autoTotal,
    autoLeft,
    driveEndsAt,
    drivePaused,
    ttsQueueActive,
    beatsLoading,
    cancelWork,
    cancelAutoSession,
    pauseDriveMode,
    resumeDriveMode,
    stopTtsAutoplay,
    autoChapterPhase,
    autoChapterStatus,
    t,
  ]);

  const chapterLabel = chapterTitle ?? chapter.title;
  const chapterTransitionOpen = autoChapterPhase != null;
  const chapterCloudAudio = useMemo(
    () => analyzeChapterCloudAudio(turns),
    [turns],
  );

  const downloadChapterAudio = useCallback(async () => {
    if (chapterExportBusy || !chapterCloudAudio.canExport) return;
    setChapterExportBusy(true);
    setError(null);
    try {
      const result = await exportChapterAudioFromCloud(turns, chapterLabel);
      if (!result.ok) setError(result.error ?? t("chat.chapterExportFailed"));
    } finally {
      setChapterExportBusy(false);
    }
  }, [chapterCloudAudio.canExport, chapterExportBusy, chapterLabel, turns, t]);

  const steeringPlaceholder = useMemo(() => {
    if (!steeringMode) return t("chat.placeholderWhatDo");
    if (steeringInputMode === "say") return t("chat.placeholderSay");
    if (steeringInputMode === "act") return t("chat.placeholderAct");
    return t("chat.placeholderSteering");
  }, [steeringMode, steeringInputMode, t]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onPointerDownCapture={() => {
        if (!hasTts || ttsReadOnly) return;
        unlockAudioForAutoplay();
        if (ttsAutoplay && !ttsQueueRef.current.isClipPlaying()) {
          startAudioSession();
        }
      }}
    >
      {!readOnly && turns.length > 0 ? (
        <ChapterProgressBar rows={turns} />
      ) : null}

      <div className="relative min-h-0 flex-1">
        <BubbleNavArrows
          count={turns.length}
          currentIndex={bubbleFocusIndex}
          onPrev={() => scrollToBubbleIndex(bubbleFocusIndex - 1)}
          onNext={() => scrollToBubbleIndex(bubbleFocusIndex + 1)}
        />
        <ChatScrollPane
          scrollRef={chatScrollRef}
          contentKey={`${turns.length}:${generating}`}
        >
          {loreCount > 0 ? (
            <p className="mb-2 text-center text-xs text-zinc-500">
              {t("chat.loreActive", { count: String(loreCount) })}
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
                  refreshTtsCloudQuota();
                }}
                registerTtsPlayer={
                  hasTts && !ttsReadOnly ? registerTtsPlayer : undefined
                }
                ttsReadOnly={ttsReadOnly}
                ttsAutoplayChain={ttsAutoplay && hasTts && !ttsReadOnly}
                onTtsChainPlay={requestTtsChainPlay}
                ttsPlaying={ttsPlayingTurnId === t.id}
                ttsQueued={
                  ttsQueuedTurnIds.includes(t.id) && ttsPlayingTurnId !== t.id
                }
                onTtsPlaybackChange={handleTtsPlaybackChange}
                navFocused={bubbleFocusIndex === index}
                storyLocale={storyLocale}
                storySettings={ttsStorySettings}
                chapterTitle={chapterLabel}
                onCloudQuotaChange={refreshTtsCloudQuota}
                onTtsCostCents={(cents) => void handleTurnTtsCost(t.id, cents)}
                showDialogueMarkup
              />
            </div>
          ))}

          {generating && autoChapterPhase !== "running" ? (
            <div className="scroll-mt-3 scroll-mb-3 px-1">
              <GeneratingIndicator
                label={t("chat.generating")}
                onCancel={cancelWork}
              />
            </div>
          ) : null}
        </ChatScrollPane>
      </div>

      {error ? (
        <p className="px-4 pb-2 text-center text-sm text-red-400">{error}</p>
      ) : null}

      {ttsBlockedTurnId && hasTts && !ttsReadOnly ? (
        <TtsMobileUnlockBar onResume={resumeBlockedTts} />
      ) : null}

      <div className="safe-bottom border-t border-surface-border bg-surface px-3 py-3">
        <MobileCollapsibleTools
          title={t("chat.toolsTitle")}
          hint={
            toolsActivity
              ? undefined
              : ttsReadOnly
                ? t("chat.readOnlyHint")
                : ttsQueueActive
                  ? t("chat.ttsActiveHint")
                  : ttsAutoplay
                    ? t("chat.autoplayOnHint")
                    : t("chat.autoplayOffHint")
          }
          activityLabel={toolsActivity?.label}
          onActivityCancel={toolsActivity?.onCancel}
          onActivityPause={toolsActivity?.onPause}
          activityPauseLabel={toolsActivity?.pauseLabel}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            {ttsCloudQuota ? (
              <span
                className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-500"
                title={t("chat.cloudQuotaTitle")}
              >
                {t("chat.cloudQuota", {
                  used: String(ttsCloudQuota.used),
                  max: String(ttsCloudQuota.max),
                })}
              </span>
            ) : null}
            {!readOnly && turns.length > 0 ? (
              <ChapterProgressBar rows={turns} compact />
            ) : null}
            {hasTts && chapterCloudAudio.canExport ? (
              <button
                type="button"
                onClick={() => void downloadChapterAudio()}
                disabled={chapterExportBusy}
                className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-400 disabled:opacity-40"
                title={
                  chapterCloudAudio.complete
                    ? t("chat.chapterExportTitle")
                    : t("chat.chapterExportPartial", {
                        cloud: String(chapterCloudAudio.cloudTurns),
                        total: String(chapterCloudAudio.assistantTurns),
                      })
                }
              >
                {chapterExportBusy
                  ? t("chat.chapterExportBusy")
                  : chapterCloudAudio.complete
                    ? t("chat.chapterExport")
                    : t("chat.chapterExportPartialBtn", {
                        cloud: String(chapterCloudAudio.cloudTurns),
                        total: String(chapterCloudAudio.assistantTurns),
                      })}
              </button>
            ) : null}
            {hasTts ? (
              <>
                <TtsReadOnlyToggle
                  enabled={ttsReadOnly}
                  disabled={generating || autoSession || chapterTransitionOpen}
                  onStopPlayback={stopTtsAutoplay}
                  onChange={(next) => {
                    setTtsReadOnly(next);
                    if (next) setTtsAutoplay(false);
                  }}
                />
                <TtsAutoplayToggle
                  enabled={ttsAutoplay}
                  disabled={
                    ttsReadOnly ||
                    generating ||
                    autoSession ||
                    chapterTransitionOpen
                  }
                  queueActive={ttsQueueActive}
                  onChange={(next) => {
                    setTtsAutoplay(next);
                    saveTtsAutoplay(next);
                    if (!next) stopTtsAutoplay();
                  }}
                />
              </>
            ) : null}
            <Link
              href={`/story/${storyId}`}
              className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-400"
            >
              {t("chat.storyLink")}
            </Link>
            <Link
              href={`/story/${storyId}/voices`}
              className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-400"
            >
              {t("chat.voicesLink")}
            </Link>
            {!readOnly ? (
              <Link
                href={`/story/${storyId}/chapter`}
                className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-400"
              >
                {t("chat.closeChapter")}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={copyCurrentChatDebug}
              disabled={turns.length === 0}
              className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-400 disabled:opacity-40"
              title={t("chat.copyChatTitle")}
            >
              {copiedChatDebug ? t("chat.copyChatCopied") : t("chat.copyChat")}
            </button>
          </div>
          {!readOnly ? (
            <AutoPlayControls
              disabled={
                ttsReadOnly ||
                generating ||
                autoSession ||
                chapterTransitionOpen ||
                turns.length === 0
              }
              onDriveStart={hasTts && !ttsReadOnly ? runDriveMode : undefined}
            />
          ) : null}
        </MobileCollapsibleTools>

        {!readOnly ? (
          <>
            {beatOptions?.length || beatsLoading ? (
              <div className="mb-2">
                <StoryBeatPicker
                  disabled={
                    generating || autoSession || chapterTransitionOpen || turns.length === 0
                  }
                  loading={beatsLoading}
                  options={beatOptions}
                  onRequestBeats={requestBeatSuggestions}
                  onSelectBeat={playChosenBeat}
                  onDismiss={requestBeatSuggestions}
                  onQuickContinue={quickContinue}
                  onAutoPlay={runMultiContinue}
                />
              </div>
            ) : null}
            <ChatSteeringBar
              expanded={inputExpanded}
              onToggleExpanded={() => setInputExpanded((v) => !v)}
              input={input}
              onInputChange={setInput}
              onSend={() => void sendMessage()}
              onQuickReaction={(id) => void sendQuickReaction(id)}
              onEnsureExpanded={() => setInputExpanded(true)}
              placeholder={steeringPlaceholder}
              disabled={
                autoSession || readOnly || chapterTransitionOpen || turns.length === 0
              }
              generating={generating && autoChapterPhase !== "running"}
              onCancel={cancelWork}
              locale={storyLocale}
              steeringMode={steeringMode}
              steeringInputMode={steeringInputMode}
              onSteeringInputModeChange={setSteeringInputMode}
            >
              {!beatOptions?.length && !beatsLoading ? (
                <StoryBeatPicker
                  disabled={
                    generating || autoSession || chapterTransitionOpen || turns.length === 0
                  }
                  loading={beatsLoading}
                  options={beatOptions}
                  onRequestBeats={requestBeatSuggestions}
                  onSelectBeat={playChosenBeat}
                  onDismiss={requestBeatSuggestions}
                  onQuickContinue={quickContinue}
                  onAutoPlay={runMultiContinue}
                />
              ) : null}
            </ChatSteeringBar>
          </>
        ) : null}
      </div>

      {autoChapterPhase ? (
        <AutoChapterOverlay
          open
          phase={autoChapterPhase}
          rows={autoChapterRows}
          status={autoChapterStatus}
          onAutoContinue={() => void executeAutoChapterClose(autoChapterRows)}
          onManualTransition={openManualChapterTransition}
          onDismiss={dismissAutoChapterPrompt}
        />
      ) : null}
    </div>
  );
}

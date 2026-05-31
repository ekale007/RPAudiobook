import type { MessageAudioPlayerHandle } from "@/lib/tts/messageAudioPlayerHandle";
import { isAutoplayBlockedError } from "@/lib/tts/autoplayPolicy";

/** Serial TTS playback — new turns, manual ▶ with autoplay, and follow-up buffering. */
export class TtsAutoplayQueue {
  private queue: string[] = [];
  private players = new Map<string, MessageAudioPlayerHandle>();
  private assistantOrder: string[] = [];
  private draining = false;
  private stopped = false;
  private preparing = new Set<string>();

  register(turnId: string, handle: MessageAudioPlayerHandle | null) {
    if (handle) this.players.set(turnId, handle);
    else this.players.delete(turnId);
  }

  /** Chapter order of assistant turn ids (for chaining after the current clip). */
  setAssistantTurnOrder(turnIds: string[]) {
    this.assistantOrder = turnIds;
  }

  enqueue(turnIds: string[]) {
    if (!turnIds.length) return;
    this.stopped = false;
    const seen = new Set(this.queue);
    for (const id of turnIds) {
      if (seen.has(id)) continue;
      this.queue.push(id);
      seen.add(id);
    }
    if (!this.queue.length) return;
    this.notify();
    this.notifyQueue();
    void this.drain();
  }

  /** Play from this turn through all following assistant turns in chapter order. */
  playFrom(turnId: string, orderedAssistantIds?: string[]) {
    const order = orderedAssistantIds ?? this.assistantOrder;
    const idx = order.indexOf(turnId);
    if (idx < 0) return;

    this.stopped = false;
    for (const [id, player] of this.players) {
      if (id !== turnId) player.stop();
    }
    this.queue = order.slice(idx);
    this.notify();
    this.notifyQueue();
    void this.drain();
  }

  stop() {
    this.stopped = true;
    this.queue = [];
    for (const player of this.players.values()) {
      player.stop();
    }
    this.draining = false;
    this.notify();
    this.notifyQueue();
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get isActive(): boolean {
    return this.draining || this.queue.length > 0;
  }

  /** Resolves when the queue is empty and the current clip finished. */
  waitUntilIdle(): Promise<void> {
    if (!this.isActive) return Promise.resolve();
    return new Promise((resolve) => {
      const unsub = this.subscribe((active) => {
        if (!active) {
          unsub();
          resolve();
        }
      });
    });
  }

  subscribe(listener: (active: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeQueue(listener: (queued: string[]) => void): () => void {
    this.queueListeners.add(listener);
    listener([...this.queue]);
    return () => this.queueListeners.delete(listener);
  }

  private listeners = new Set<(active: boolean) => void>();
  private queueListeners = new Set<(queued: string[]) => void>();

  private notify() {
    const active = this.isActive;
    for (const listener of this.listeners) listener(active);
  }

  private notifyQueue() {
    const queued = [...this.queue];
    for (const listener of this.queueListeners) listener(queued);
  }

  private enqueueFollowing(currentTurnId: string) {
    const idx = this.assistantOrder.indexOf(currentTurnId);
    if (idx < 0 || idx >= this.assistantOrder.length - 1) return;
    this.enqueue(this.assistantOrder.slice(idx + 1));
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    this.notify();

    while (this.queue.length > 0 && !this.stopped) {
      const turnId = this.queue[0]!;
      this.enqueueFollowing(turnId);
      this.prewarmUpcoming(2, 1);
      let player = this.players.get(turnId);
      if (!player) {
        await new Promise((r) => setTimeout(r, 80));
        player = this.players.get(turnId);
      }
      if (!player || this.stopped) {
        this.queue.shift();
        this.notifyQueue();
        continue;
      }

      this.queue.shift();
      this.notifyQueue();
      try {
        await player.play();
      } catch (error) {
        if (isAutoplayBlockedError(error)) {
          this.queue.unshift(turnId);
          break;
        }
        /* skip other failed clips */
      }
    }

    this.draining = false;
    if (this.queue.length > 0 && !this.stopped) void this.drain();
    else {
      this.notify();
      this.notifyQueue();
    }
  }

  private prewarmUpcoming(maxCount: number, startOffset = 0) {
    const candidates = this.queue.slice(startOffset, startOffset + maxCount);
    for (const turnId of candidates) {
      if (this.preparing.has(turnId)) continue;
      const player = this.players.get(turnId);
      if (!player) continue;
      this.preparing.add(turnId);
      player
        .prepare()
        .catch(() => {
          /* ignore warmup errors; normal play will retry */
        })
        .finally(() => {
          this.preparing.delete(turnId);
        });
    }
  }
}

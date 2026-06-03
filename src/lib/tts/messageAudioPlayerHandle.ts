export type MessageAudioPlayerHandle = {
  prepare: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  /** Resume only when paused — no restart from the beginning. */
  resumeIfPaused: () => Promise<void>;
  stop: () => void;
};

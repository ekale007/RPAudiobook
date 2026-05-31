export type MessageAudioPlayerHandle = {
  prepare: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
};

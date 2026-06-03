/**
 * Lock screen & CarPlay (Now Playing) via Media Session + HTML <audio>.
 * Web Audio output does not chain reliably when the screen is locked on iOS.
 */

export type TtsNowPlayingMeta = {
  title: string;
  artist?: string;
  album?: string;
};

export type TtsMediaSessionControls = {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
};

let controls: TtsMediaSessionControls | null = null;
let installed = false;

function ms(): MediaSession | null {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return null;
  }
  return navigator.mediaSession;
}

export function setTtsMediaSessionControls(next: TtsMediaSessionControls | null) {
  controls = next;
  if (!next) {
    clearTtsMediaSessionHandlers();
    return;
  }
  installTtsMediaSessionHandlers();
}

function installTtsMediaSessionHandlers(): void {
  const session = ms();
  if (!session || installed) return;
  installed = true;

  try {
    session.setActionHandler("play", () => controls?.onPlay());
    session.setActionHandler("pause", () => controls?.onPause());
    session.setActionHandler("nexttrack", () => controls?.onNext());
    session.setActionHandler("previoustrack", () => undefined);
  } catch {
    /* Safari versions may reject some handlers */
  }
}

export function clearTtsMediaSessionHandlers(): void {
  const session = ms();
  if (!session) return;
  installed = false;
  try {
    session.setActionHandler("play", null);
    session.setActionHandler("pause", null);
    session.setActionHandler("nexttrack", null);
    session.setActionHandler("previoustrack", null);
  } catch {
    /* ignore */
  }
}

export function setTtsNowPlaying(meta: TtsNowPlayingMeta): void {
  const session = ms();
  if (!session) return;
  try {
    session.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.artist ?? "HörbuchKI",
      album: meta.album,
      artwork: [
        {
          src: "/icon.svg",
          sizes: "512x512",
          type: "image/svg+xml",
        },
      ],
    });
  } catch {
    /* ignore */
  }
}

export function setTtsMediaPlaybackState(
  state: MediaSessionPlaybackState,
): void {
  const session = ms();
  if (!session) return;
  try {
    session.playbackState = state;
  } catch {
    /* ignore */
  }
}

export function syncTtsMediaPosition(
  position: number,
  duration: number,
  playbackRate = 1,
): void {
  const session = ms();
  if (!session || !("setPositionState" in session)) return;
  if (!Number.isFinite(duration) || duration <= 0) return;
  try {
    session.setPositionState({
      duration,
      playbackRate,
      position: Math.min(duration, Math.max(0, position)),
    });
  } catch {
    /* iOS may reject until playback started */
  }
}

export function clearTtsNowPlaying(): void {
  const session = ms();
  if (!session) return;
  try {
    session.metadata = null;
    session.playbackState = "none";
  } catch {
    /* ignore */
  }
}

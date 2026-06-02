"use client";

type Props = {
  onResume: () => void;
};

/** Shown when mobile Safari blocks chained TTS — one tap resumes the queue. */
export function TtsMobileUnlockBar({ onResume }: Props) {
  return (
    <div
      role="status"
      className="mx-3 mb-2 rounded-lg border border-accent/40 bg-accent/15 px-4 py-3 text-center shadow-lg"
    >
      <p className="text-sm text-zinc-200">
        Wiedergabe pausiert — tippe einmal, um die Sprachausgabe fortzusetzen.
      </p>
      <button
        type="button"
        onClick={onResume}
        className="touch-target mt-3 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black"
      >
        Weiter hören
      </button>
    </div>
  );
}

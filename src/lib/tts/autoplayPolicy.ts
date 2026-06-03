/** Mobile Safari / Chrome block audio.play() without a user gesture. */
export function isAutoplayBlockedError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return true;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("not allowed by the user agent") ||
      msg.includes("didn't interact with the document") ||
      msg.includes("user denied permission") ||
      msg.includes("play() request was interrupted")
    );
  }
  return false;
}

export function autoplayBlockedHint(): string {
  return "Autoplay blockiert — erneut ▶ oder TTS-Autoplay antippen";
}

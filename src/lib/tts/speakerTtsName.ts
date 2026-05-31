/**
 * Short speakable label for TTS (no card subtitles like "— The Devil").
 * UI keeps the full character.name from the database.
 */
export function speakerTtsLabel(cardName: string): string {
  let s = cardName.trim();
  if (!s) return s;

  // "Lucifer — The Devil" / "Lucifer - The Devil"
  s = s.replace(/\s*[—–-]\s*.+$/u, "").trim();

  // "Lucifer the Devil" (subtitle after "the")
  const theSubtitle = s.match(/^(.+?)\s+the\s+\S/i);
  if (theSubtitle?.[1]) s = theSubtitle[1].trim();

  // "Kaelen Vellen" → first name for speech prefixes
  const first = s.split(/\s+/)[0]?.trim();
  return first || s;
}

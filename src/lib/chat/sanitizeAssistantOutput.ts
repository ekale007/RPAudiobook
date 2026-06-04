/** Remove RPG/UI leakage the model sometimes copies from scenario seeds. */
export function stripGameMetaLeaks(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      kept.push(line);
      continue;
    }
    if (/^was tust du\??$/i.test(t)) continue;
    if (/^what do you do\??$/i.test(t)) continue;
    if (/\[\s*quest[-\s]?option/i.test(t)) continue;
    if (/\[\s*optional\s+quest/i.test(t)) continue;
    if (/\[\s*system\b/i.test(t)) continue;
    if (/\[\s*tutorial[-\s]?quest/i.test(t)) continue;
    if (/^\[\s*system\s+null/i.test(t)) continue;
    if (/^das system (wirft|zeigt|blinkt)/i.test(t)) continue;
    if (/^the system (throws|shows|blinks)/i.test(t)) continue;
    if (/stufe:\s*\d+/i.test(t) && /\|\s*hp:/i.test(t)) continue;
    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

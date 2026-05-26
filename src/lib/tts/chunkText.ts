/** Split long narrator text for ElevenLabs requests (~2.5k chars per chunk). */
export function chunkTextForTts(text: string, maxChars = 2400): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  const paragraphs = normalized.split(/\n\n+/);
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      flush();
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      continue;
    }

    const next = current ? `${current}\n\n${para}` : para;
    if (next.length > maxChars) {
      flush();
      current = para;
    } else {
      current = next;
    }
  }
  flush();
  return chunks.length ? chunks : [normalized.slice(0, maxChars)];
}

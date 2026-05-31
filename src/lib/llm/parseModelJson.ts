/** Best-effort JSON extraction from LLM text (markdown fences, prose wrappers, minor defects). */

function repairTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, "$1");
}

function extractBalancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function closeTruncatedJson(fragment: string): string {
  let json = fragment.trim();
  if (!json.startsWith("{")) return json;

  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") braces++;
    if (c === "}") braces--;
    if (c === "[") brackets++;
    if (c === "]") brackets--;
  }

  if (inString) json += '"';
  json = repairTrailingCommas(json);
  while (brackets > 0) {
    json += "]";
    brackets--;
  }
  while (braces > 0) {
    json += "}";
    braces--;
  }
  return json;
}

function tryParse(json: string): unknown | null {
  const attempts = [
    json,
    repairTrailingCommas(json),
    closeTruncatedJson(json),
    repairTrailingCommas(closeTruncatedJson(json)),
  ];

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* next */
    }
  }
  return null;
}

export function parseModelJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const fromFence = tryParse(fenced[1].trim());
    if (fromFence) return fromFence;
  }

  const start = trimmed.indexOf("{");
  if (start >= 0) {
    const balanced = extractBalancedObject(trimmed, start);
    if (balanced) {
      const parsed = tryParse(balanced);
      if (parsed) return parsed;
    }
    const tail = trimmed.slice(start);
    const parsedTail = tryParse(tail);
    if (parsedTail) return parsedTail;
  }

  return null;
}

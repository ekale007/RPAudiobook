import { buildChatMessages } from "@/lib/prompt/buildPrompt";
import type { PromptContext } from "@/lib/prompt/buildPrompt";
import {
  buildSteeringWriterTaskMessage,
  classifySteeringDisplay,
  formatSteeringActionUserTurn,
  formatSteeringDialogueUserTurn,
  formatSteeringUserTurnContent,
  normalizeSteeringDialogueInput,
  stripSteeringTurnPrefix,
  STEERING_TURN_PREFIX,
  type SteeringDisplayKind,
  type SteeringInputMode,
} from "@/lib/chat/playerSteering";
import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { OpenRouterSettings } from "@/lib/types";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";

export type ConvertedSteering = {
  kind: "dialogue" | "action";
  /** Label in the steering bubble (without ↪ prefix). */
  display: string;
  /** User message content for the main narrator LLM call. */
  writerTask: string;
  dialogueLine?: string;
};

const CONVERT_PROMPT_DE = `Du bist Steuerungs-Konverter für ein interaktives Hörbuch-RPG.

Aufgabe: Die kurze Spieler-Eingabe in ein präzises Autoren-Briefing für den **nächsten** Erzähler-Abschnitt umwandeln. Der Erzähler schreibt danach mit Dialog-Skript-Tags (\`<<speaker:narrator>>\`, \`<<speaker:protagonist>>\`, Cast-Slugs).

Eingabe-Typ vom UI: "{inputMode}"
- "say" = gesprochene Zeile (Dialog)
- "act" = Handlung / Körper / Entscheidung (kein Zitat)
- "auto" = selbst erkennen (Anführungszeichen → dialogue, sonst action)

Spieler-Roheingabe:
"""
{raw}
"""

Gib NUR gültiges JSON (kein Markdown):
{
  "kind": "dialogue" | "action",
  "display": "Kurzer Text für die Steuerungs-Blase. dialogue: „…" mit deutschen Anführungszeichen. action: beginnt mit ⚡ und beschreibt die Handlung kurz.",
  "dialogueLine": "nur bei kind dialogue: gesprochene Zeile ohne Anführungszeichen",
  "writerTask": "Vollständiges Briefing auf Deutsch mit ## Aufgabe, Pflicht-Struktur, Verboten-Liste. Bei dialogue: zuerst kurzer narrator, dann protagonist mit Pflicht-Zitat. Bei action: narrator zeigt die Handlung des Protagonisten lebendig (Sinne, Bewegung, Konsequenz), dann ggf. Dialog/Reaktionen. Kein QUEST-UI, kein Was tust du."
}

Regeln:
- Bleib strikt bei der Spieler-Absicht; nichts erfinden, was der Spieler nicht meint.
- writerTask muss so konkret sein, dass der Erzähler die Steuerung **sichtbar** in der Szene umsetzt — nicht nur andeuten.
- Keine Wiederholung langer Passagen aus dem Kontext.
- writerTask muss **nahtlos** an den letzten Erzähler-Abschnitt anschließen: keine Szene von vorn, kein erneutes Nennen von Position/Haltung/Atmosphäre, die schon etabliert ist.`;

const CONVERT_PROMPT_EN = `You convert a short player steering input into a precise author brief for the **next** narrator segment (dialogue script with \`<<speaker:…>>\` tags).

UI input type: "{inputMode}"
- "say" = spoken line
- "act" = action / movement / decision (not a quote)
- "auto" = detect (quotes → dialogue, else action)

Player raw input:
"""
{raw}
"""

Return ONLY valid JSON:
{
  "kind": "dialogue" | "action",
  "display": "Short steering bubble label. dialogue: quoted line. action: starts with ⚡ and summarizes the action.",
  "dialogueLine": "only for dialogue: spoken line without quotes",
  "writerTask": "Full English brief with ## Task, required structure, forbidden list. dialogue: brief narrator then protagonist with mandatory quote. action: narrator shows the action vividly, then optional dialogue. No quest UI. Must continue seamlessly from the last narrator beat — no scene re-establishment."
}`;

function convertUserPrompt(
  raw: string,
  inputMode: SteeringInputMode,
  locale: "de" | "en",
): string {
  const template = locale === "de" ? CONVERT_PROMPT_DE : CONVERT_PROMPT_EN;
  return template
    .replace("{raw}", raw.replace(/"""/g, '\\"\\"\\"'))
    .replace("{inputMode}", inputMode);
}

function resolveIntendedKind(
  raw: string,
  inputMode: SteeringInputMode,
): "dialogue" | "action" {
  if (inputMode === "say") return "dialogue";
  if (inputMode === "act") return "action";
  const classified = classifySteeringDisplay(raw.trim());
  return classified === "dialogue" ? "dialogue" : "action";
}

function fallbackConverted(
  raw: string,
  inputMode: SteeringInputMode,
  storyLocale?: string | null,
  protagonistName?: string | null,
): ConvertedSteering {
  const kind = resolveIntendedKind(raw, inputMode);
  const locale = normalizeStoryLocale(storyLocale);

  if (kind === "dialogue") {
    const line = normalizeSteeringDialogueInput(raw);
    const display = stripSteeringTurnPrefix(
      formatSteeringDialogueUserTurn(line, storyLocale),
    );
    return {
      kind: "dialogue",
      display,
      dialogueLine: line,
      writerTask: buildSteeringWriterTaskMessage(
        formatSteeringDialogueUserTurn(line, storyLocale).replace(
          STEERING_TURN_PREFIX,
          "",
        ),
        storyLocale,
        protagonistName,
      ),
    };
  }

  const action = raw.trim().replace(/^⚡\s*/, "");
  const display = stripSteeringTurnPrefix(
    formatSteeringActionUserTurn(action, storyLocale),
  );
  return {
    kind: "action",
    display,
    writerTask: buildSteeringWriterTaskMessage(
      display,
      storyLocale,
      protagonistName,
    ),
  };
}

function mapJsonKind(
  kind: string | undefined,
  fallback: ConvertedSteering["kind"],
): ConvertedSteering["kind"] {
  if (kind === "dialogue" || kind === "action") return kind;
  if (kind === "direction") return "action";
  return fallback;
}

function parseConvertedJson(
  raw: string,
  fallback: ConvertedSteering,
): ConvertedSteering {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      kind?: string;
      display?: string;
      dialogueLine?: string;
      writerTask?: string;
    };
    const kind = mapJsonKind(parsed.kind, fallback.kind);
    const writerTask = parsed.writerTask?.trim();
    const display = parsed.display?.trim();
    if (!writerTask || !display) return fallback;

    const out: ConvertedSteering = {
      kind,
      display: display.startsWith(STEERING_TURN_PREFIX)
        ? display.slice(STEERING_TURN_PREFIX.length)
        : display,
      writerTask,
    };
    if (kind === "dialogue") {
      const line =
        parsed.dialogueLine?.trim() ||
        normalizeSteeringDialogueInput(display) ||
        fallback.dialogueLine;
      if (line) out.dialogueLine = line;
    }
    return out;
  } catch {
    return fallback;
  }
}

export type ConvertSteeringParams = {
  rawInput: string;
  inputMode: SteeringInputMode;
  settings: OpenRouterSettings;
  promptCtx: PromptContext;
  storyLocale?: string | null;
  protagonistName?: string | null;
  signal?: AbortSignal;
};

export async function convertPlayerSteeringInput(
  params: ConvertSteeringParams,
): Promise<ConvertedSteering> {
  const raw = params.rawInput.trim();
  if (!raw) {
    throw new Error("Leere Steuerung.");
  }

  const fallback = fallbackConverted(
    raw,
    params.inputMode,
    params.storyLocale,
    params.protagonistName,
  );

  const locale = normalizeStoryLocale(params.storyLocale);
  const { messages } = buildChatMessages(params.promptCtx);
  const withRequest = [
    ...messages,
    {
      role: "user" as const,
      content: convertUserPrompt(raw, params.inputMode, locale),
    },
  ];

  try {
    const response = await completeOpenRouter(params.settings, withRequest, {
      maxTokens: 900,
      temperature: 0.55,
      signal: params.signal,
      responseFormat: { type: "json_object" },
    });
    return parseConvertedJson(response, fallback);
  } catch {
    return fallback;
  }
}

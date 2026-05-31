import { completeOpenRouter } from "@/lib/llm/openrouter";
import { parseModelJson } from "@/lib/llm/parseModelJson";
import type { ChatTurn, OpenRouterSettings } from "@/lib/types";
export type ThreatStatus =
  | "active"
  | "defeated"
  | "avoided"
  | "cancelled"
  | "unknown";

export interface PlotThreat {
  id: string;
  label: string;
  status: ThreatStatus;
  detail?: string;
}

/** Character not physically in the current scene (left, elsewhere, etc.). */
export interface AbsentCharacter {
  name: string;
  reason: string;
  location?: string;
  /** When they might return, e.g. "tomorrow morning at the gate" */
  returnsWhen?: string;
}

/** Future in-story appointment — characters must not appear early. */
export interface ScheduledEvent {
  when: string;
  participants: string[];
  location?: string;
  note?: string;
}

export interface StoryPlotState {
  version: 1;
  updatedAt: string;
  /** In-story time label, NOT a stale countdown unless still active */
  timeLabel: string;
  location: string;
  /** Physically present in the current scene right now */
  presentCharacters: string[];
  /** Left the scene but still in the story — NOT present until they return */
  absentCharacters: AbsentCharacter[];
  /** Future meetings / appointments */
  scheduledEvents: ScheduledEvent[];
  threats: PlotThreat[];
  resolvedFacts: string[];
  openThreads: string[];
  /** What NPCs / the world publicly knows */
  publicKnowledge: string[];
}

export const EMPTY_PLOT_STATE: StoryPlotState = {
  version: 1,
  updatedAt: "",
  timeLabel: "",
  location: "",
  presentCharacters: [],
  absentCharacters: [],
  scheduledEvents: [],
  threats: [],
  resolvedFacts: [],
  openThreads: [],
  publicKnowledge: [],
};

const PLACEHOLDER = new Set(["unknown", "unbekannt", "?", "—", "-"]);

export function isPlotStatePlaceholder(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase() ?? "";
  return !v || PLACEHOLDER.has(v);
}

/** True when there is nothing meaningful to show or inject into prompts. */
export function isPlotStateEmpty(state: StoryPlotState | null | undefined): boolean {
  if (!state) return true;
  const hasMeta =
    !isPlotStatePlaceholder(state.timeLabel) ||
    !isPlotStatePlaceholder(state.location) ||
    state.presentCharacters.length > 0 ||
    state.absentCharacters.length > 0 ||
    state.scheduledEvents.length > 0 ||
    state.threats.length > 0 ||
    state.resolvedFacts.length > 0 ||
    state.openThreads.length > 0 ||
    state.publicKnowledge.length > 0;
  return !hasMeta;
}

export function parsePlotState(raw: unknown): StoryPlotState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<StoryPlotState>;
  if (o.version !== undefined && o.version !== 1) return null;
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "",
    timeLabel: typeof o.timeLabel === "string" ? o.timeLabel : "",
    location: typeof o.location === "string" ? o.location : "",
    presentCharacters: Array.isArray(o.presentCharacters)
      ? o.presentCharacters.filter((x): x is string => typeof x === "string")
      : [],
    absentCharacters: parseAbsentCharacters(o.absentCharacters),
    scheduledEvents: parseScheduledEvents(o.scheduledEvents),
    threats: Array.isArray(o.threats)
      ? o.threats
          .filter(
            (t): t is PlotThreat =>
              !!t &&
              typeof t === "object" &&
              typeof (t as PlotThreat).id === "string" &&
              typeof (t as PlotThreat).label === "string",
          )
          .map((t) => ({
            id: t.id,
            label: t.label,
            status: normalizeThreatStatus(t.status),
            detail: typeof t.detail === "string" ? t.detail : undefined,
          }))
      : [],
    resolvedFacts: stringArray(o.resolvedFacts),
    openThreads: stringArray(o.openThreads),
    publicKnowledge: stringArray(o.publicKnowledge),
  };
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function parseAbsentCharacters(v: unknown): AbsentCharacter[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (x): x is AbsentCharacter =>
        !!x &&
        typeof x === "object" &&
        typeof (x as AbsentCharacter).name === "string" &&
        typeof (x as AbsentCharacter).reason === "string",
    )
    .map((a) => ({
      name: a.name.trim(),
      reason: a.reason.trim(),
      location: typeof a.location === "string" ? a.location.trim() : undefined,
      returnsWhen:
        typeof a.returnsWhen === "string" ? a.returnsWhen.trim() : undefined,
    }))
    .filter((a) => a.name && a.reason);
}

function parseScheduledEvents(v: unknown): ScheduledEvent[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (x): x is ScheduledEvent =>
        !!x &&
        typeof x === "object" &&
        typeof (x as ScheduledEvent).when === "string" &&
        Array.isArray((x as ScheduledEvent).participants),
    )
    .map((e) => ({
      when: e.when.trim(),
      participants: e.participants.filter(
        (p): p is string => typeof p === "string" && p.trim().length > 0,
      ),
      location: typeof e.location === "string" ? e.location.trim() : undefined,
      note: typeof e.note === "string" ? e.note.trim() : undefined,
    }))
    .filter((e) => e.when && e.participants.length > 0);
}

function normalizeThreatStatus(s: unknown): ThreatStatus {
  if (
    s === "active" ||
    s === "defeated" ||
    s === "avoided" ||
    s === "cancelled" ||
    s === "unknown"
  ) {
    return s;
  }
  return "unknown";
}

function formatTurnLine(t: ChatTurn): string {
  if (t.role === "system") return "";
  const who =
    t.speakerSlug && t.speakerSlug !== "narrator"
      ? `${t.role} (${t.speakerSlug})`
      : t.role;
  return `${who}: ${t.content}`;
}

function buildTranscript(turns: ChatTurn[], maxChars = 42000): string {
  const full = turns
    .filter((t) => t.role !== "system")
    .map(formatTurnLine)
    .filter(Boolean)
    .join("\n\n");
  if (full.length <= maxChars) return full;
  return `[…earlier omitted…]\n\n${full.slice(-maxChars)}`;
}

function parsePlotJsonFromModel(raw: string): StoryPlotState | null {
  const json = parseModelJson(raw);
  if (!json || typeof json !== "object") return null;
  if ((json as Record<string, unknown>).version === undefined) {
    (json as Record<string, unknown>).version = 1;
  }
  return parsePlotState(json);
}

async function requestPlotStateJson(
  settings: OpenRouterSettings,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const opts = { maxTokens: 1800, temperature: 0.15 };
  try {
    return await completeOpenRouter(settings, messages, {
      ...opts,
      responseFormat: { type: "json_object" },
    });
  } catch {
    return completeOpenRouter(settings, messages, opts);
  }
}

async function repairPlotStateJson(
  settings: OpenRouterSettings,
  broken: string,
): Promise<string> {
  return requestPlotStateJson(settings, [
    {
      role: "system",
      content:
        "Fix the text into one valid JSON object. Output JSON only — no markdown, no explanation.",
    },
    {
      role: "user",
      content: `Schema keys: timeLabel, location, presentCharacters, absentCharacters, scheduledEvents, threats, resolvedFacts, openThreads, publicKnowledge.\n\nBroken text:\n${broken.slice(0, 8000)}`,
    },
  ]);
}

export class PlotStateExtractError extends Error {
  constructor(
    message: string,
    readonly rawPreview?: string,
  ) {
    super(message);
    this.name = "PlotStateExtractError";
  }
}

/**
 * Extract structured RP plot state from the chapter transcript.
 * This is the authoritative source for threats, time, and resolved facts.
 */
export async function extractPlotState(
  settings: OpenRouterSettings,
  turns: ChatTurn[],
  existing: StoryPlotState | null,
  opts?: {
    chapterTitle?: string;
    phaseHint?: string | null;
    /** When true (Story-Gedächtnis UI), surface parse failures to the user. */
    strict?: boolean;
  },
): Promise<StoryPlotState> {
  if (!turns.some((t) => t.role !== "system")) {
    return existing ?? { ...EMPTY_PLOT_STATE, updatedAt: new Date().toISOString() };
  }

  const messages = [
    {
      role: "system",
      content: `You maintain structured plot state for an interactive RPG.

Output a single JSON object (no markdown fences, no commentary before or after).
Required keys: timeLabel, location, presentCharacters, absentCharacters, scheduledEvents, threats, resolvedFacts, openThreads, publicKnowledge.
Use empty arrays [] when a list has no items. Use concrete strings for timeLabel and location when known.

Example shape:
{"timeLabel":"Tuesday evening","location":"Harbor tavern","presentCharacters":["Marcus"],"absentCharacters":[{"name":"Naya","reason":"went home","location":"city","returnsWhen":"tomorrow morning"}],"scheduledEvents":[],"threats":[],"resolvedFacts":[],"openThreads":[],"publicKnowledge":[]}

Rules:- Use the END of the transcript as the latest truth.
- **Presence:** If someone left the location, went home, walked away, or agreed to meet later, they belong in absentCharacters — remove them from presentCharacters.
- **Time:** Advance timeLabel when minutes/hours/days pass in the transcript. Do not snap back to an earlier time unless the player explicitly rewinds.
- **Scheduled meetings:** If characters agree to meet tomorrow / later / at another place, add a scheduledEvent. Until that time arrives in the story, those characters must stay absent unless the transcript shows them returning early.
- **Returning to a location:** When the player revisits a place shortly after leaving, do NOT repopulate NPCs who departed unless the transcript shows they came back.
- If the invasion fleet / main villain was destroyed, defeated, or driven off, set that threat status to "defeated" or "cancelled" — do NOT keep an active countdown.
- If everyone in the story knows something, add it to publicKnowledge.
- Merge with existing state when still true; remove contradicted facts.
- Identify threats by stable ids (e.g. invasion_fleet, main_villain).`,
    },
    {
      role: "user",
      content: [
        opts?.chapterTitle ? `Chapter: ${opts.chapterTitle}` : null,
        opts?.phaseHint ? `Author phase hint: ${opts.phaseHint}` : null,
        existing
          ? `Existing plot state JSON:\n${JSON.stringify(existing, null, 2)}`
          : "Existing plot state: (none)",
        `Transcript:\n${buildTranscript(turns)}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  let raw = await requestPlotStateJson(settings, messages);

  if (!raw.trim()) {
    if (opts?.strict) {
      throw new PlotStateExtractError(
        "KI-Antwort leer — das Modell hat keinen Plot-State geliefert.",
      );
    }
    return (
      existing ?? {
        ...EMPTY_PLOT_STATE,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  let parsed = parsePlotJsonFromModel(raw);

  if (!parsed && opts?.strict) {
    try {
      const repaired = await repairPlotStateJson(settings, raw);
      parsed = parsePlotJsonFromModel(repaired);
      if (parsed) raw = repaired;
    } catch {
      /* fall through to error below */
    }
  }

  if (!parsed) {
    if (opts?.strict) {
      throw new PlotStateExtractError(
        "Plot-State konnte nicht gelesen werden (ungültiges JSON). Bitte erneut versuchen oder anderes Modell in Settings wählen.",
        raw.slice(0, 400),
      );
    }
    return (
      existing ?? {
        ...EMPTY_PLOT_STATE,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  if (isPlotStateEmpty(parsed)) {
    if (opts?.strict) {
      throw new PlotStateExtractError(
        "KI lieferte nur leere/„Unknown“-Felder — nichts Sinnvolles zum Speichern.",
        raw.slice(0, 280),
      );
    }
    if (existing && !isPlotStateEmpty(existing)) {
      return { ...existing, updatedAt: new Date().toISOString() };
    }
  }

  const merged: StoryPlotState = {
    ...parsed,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  return merged;
}

export function hasActiveThreats(state: StoryPlotState | null | undefined): boolean {
  return !!state?.threats.some((t) => t.status === "active");
}

export function defeatedThreatLabels(
  state: StoryPlotState | null | undefined,
): string[] {
  if (!state) return [];
  return state.threats
    .filter((t) => t.status === "defeated" || t.status === "cancelled")
    .map((t) => t.label);
}

export function formatPlotStateForPrompt(
  state: StoryPlotState | null | undefined,
): string | null {
  if (!state || isPlotStateEmpty(state)) return null;

  const lines: string[] = [
    "## Plot state (AUTHORITATIVE for threats, time, and facts)",
    "If this block contradicts older summaries, the character card scenario, or a countdown tag, **follow this block**.",
  ];

  if (!isPlotStatePlaceholder(state.timeLabel)) {
    lines.push("", `**Time:** ${state.timeLabel}`);
  }
  if (!isPlotStatePlaceholder(state.location)) {
    lines.push(`**Location:** ${state.location}`);
  }

  if (state.presentCharacters.length) {
    lines.push(`**Present (in scene now):** ${state.presentCharacters.join(", ")}`);
  }

  if (state.absentCharacters.length) {
    lines.push("", "**Absent (NOT in scene — do not write them as present):**");
    for (const a of state.absentCharacters) {
      const parts = [a.reason];
      if (a.location) parts.push(`at ${a.location}`);
      if (a.returnsWhen) parts.push(`returns ${a.returnsWhen}`);
      lines.push(`- ${a.name}: ${parts.join("; ")}`);
    }
  }

  if (state.scheduledEvents.length) {
    lines.push("", "**Scheduled (future — participants stay absent until this time):**");
    for (const e of state.scheduledEvents) {
      const where = e.location ? ` @ ${e.location}` : "";
      const note = e.note ? ` — ${e.note}` : "";
      lines.push(
        `- ${e.when}: ${e.participants.join(", ")}${where}${note}`,
      );
    }
  }

  if (state.threats.length) {
    lines.push("", "**Threats:**");
    for (const t of state.threats) {
      const detail = t.detail ? ` — ${t.detail}` : "";
      lines.push(`- ${t.label} (\`${t.id}\`): **${t.status.toUpperCase()}**${detail}`);
    }
  }

  if (state.resolvedFacts.length) {
    lines.push("", "**Resolved (do not undo):**");
    for (const f of state.resolvedFacts) lines.push(`- ${f}`);
  }

  if (state.publicKnowledge.length) {
    lines.push("", "**Public / NPC knowledge:**");
    for (const k of state.publicKnowledge) lines.push(`- ${k}`);
  }

  if (state.openThreads.length) {
    lines.push("", "**Open threads:**");
    for (const o of state.openThreads) lines.push(`- ${o}`);
  }

  const defeated = state.threats.filter(
    (t) => t.status === "defeated" || t.status === "cancelled",
  );
  if (defeated.length) {
    lines.push(
      "",
      "**Narration rule:** Do NOT treat defeated/cancelled threats as still incoming. No countdown timers for them unless the player explicitly revives the threat.",
    );
  }

  if (!hasActiveThreats(state)) {
    lines.push(
      "",
      "**Narration rule:** No active existential countdown — advance time naturally without inventing a new invasion deadline.",
    );
  }

  if (state.absentCharacters.length || state.scheduledEvents.length) {
    lines.push(
      "",
      "**Presence rule:** Only characters listed under Present may speak or act in the current scene. Absent characters and scheduled-meeting participants must NOT reappear until in-story time reaches their return or meeting — even if the player returns to an earlier location.",
    );
  }

  return lines.join("\n");
}

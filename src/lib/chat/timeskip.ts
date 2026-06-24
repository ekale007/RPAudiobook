import {
  formatSteeringUserTurnContent,
  stripSteeringTurnPrefix,
} from "@/lib/chat/playerSteering";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";

export const TIME_SKIP_MARKER = "⏩ ";

export type TimeSkipId =
  | "hours_3"
  | "next_morning"
  | "next_day"
  | "few_days"
  | "next_week"
  | "next_month";

export type TimeSkipMode = "direct" | "montage";

export type TimeSkipDef = {
  id: TimeSkipId;
  labelKey: `timeskip.${TimeSkipId}`;
};

export const TIME_SKIP_PRESETS: TimeSkipDef[] = [
  { id: "hours_3", labelKey: "timeskip.hours_3" },
  { id: "next_morning", labelKey: "timeskip.next_morning" },
  { id: "next_day", labelKey: "timeskip.next_day" },
  { id: "few_days", labelKey: "timeskip.few_days" },
  { id: "next_week", labelKey: "timeskip.next_week" },
  { id: "next_month", labelKey: "timeskip.next_month" },
];

const PREVIEW_SUFFIX_DE = " · Vorschau";
const PREVIEW_SUFFIX_EN = " · Preview";

const TIME_HINTS_DE: Record<TimeSkipId, string> = {
  hours_3: "etwa drei Stunden später",
  next_morning: "am nächsten Morgen",
  next_day: "am nächsten Tag",
  few_days: "ein paar Tage später",
  next_week: "etwa eine Woche später",
  next_month: "etwa einen Monat später",
};

const TIME_HINTS_EN: Record<TimeSkipId, string> = {
  hours_3: "about three hours later",
  next_morning: "the next morning",
  next_day: "the next day",
  few_days: "a few days later",
  next_week: "about a week later",
  next_month: "about a month later",
};

const LABELS_DE: Record<TimeSkipId, string> = {
  hours_3: "3 Std. später",
  next_morning: "Nächster Morgen",
  next_day: "Nächster Tag",
  few_days: "Ein paar Tage",
  next_week: "Nächste Woche",
  next_month: "Nächster Monat",
};

const LABELS_EN: Record<TimeSkipId, string> = {
  hours_3: "3 hours later",
  next_morning: "Next morning",
  next_day: "Next day",
  few_days: "A few days",
  next_week: "Next week",
  next_month: "Next month",
};

function timeSkipLabel(id: TimeSkipId, locale: "de" | "en"): string {
  return locale === "de" ? LABELS_DE[id] : LABELS_EN[id];
}

function timeSkipHint(id: TimeSkipId, locale: "de" | "en"): string {
  return locale === "de" ? TIME_HINTS_DE[id] : TIME_HINTS_EN[id];
}

export function formatTimeSkipUserTurn(
  id: TimeSkipId,
  mode: TimeSkipMode,
  storyLocale?: string | null,
): string {
  const locale = normalizeStoryLocale(storyLocale);
  const label = timeSkipLabel(id, locale);
  const preview =
    mode === "montage"
      ? locale === "de"
        ? PREVIEW_SUFFIX_DE
        : PREVIEW_SUFFIX_EN
      : "";
  return formatSteeringUserTurnContent(`${TIME_SKIP_MARKER}${label}${preview}`);
}

export function isTimeSkipSteeringDisplay(display: string): boolean {
  return stripSteeringTurnPrefix(display).trimStart().startsWith(TIME_SKIP_MARKER);
}

export function parseTimeSkipSteeringDisplay(
  display: string,
): { id: TimeSkipId; mode: TimeSkipMode } | null {
  let body = stripSteeringTurnPrefix(display).trim();
  if (!body.startsWith(TIME_SKIP_MARKER)) return null;
  body = body.slice(TIME_SKIP_MARKER.length).trim();

  const mode: TimeSkipMode =
    body.endsWith(PREVIEW_SUFFIX_DE) || body.endsWith(PREVIEW_SUFFIX_EN)
      ? "montage"
      : "direct";

  const label = body
    .replace(PREVIEW_SUFFIX_DE, "")
    .replace(PREVIEW_SUFFIX_EN, "")
    .trim();

  for (const id of TIME_SKIP_PRESETS.map((p) => p.id)) {
    if (label === timeSkipLabel(id, "de") || label === timeSkipLabel(id, "en")) {
      return { id, mode };
    }
  }
  return null;
}

export function buildTimeSkipContinuationPrompt(
  display: string,
  storyLocale?: string | null,
): string {
  const parsed = parseTimeSkipSteeringDisplay(display);
  const locale = normalizeStoryLocale(storyLocale);
  const hint = parsed
    ? timeSkipHint(parsed.id, locale)
    : locale === "de"
      ? "dem gewünschten Zeitpunkt"
      : "the requested time";

  if (parsed?.mode === "montage") {
    if (locale === "de") {
      return `[Steuerung: Die Spieler-Nachricht direkt darüber ist ein Zeitsprung mit Schnellvorschau bis ungefähr ${hint}. Schreibe 2–5 kurze Zwischenmomente — jede Zeile beginnt mit einer klaren Zeitangabe (z. B. „17:40 —" oder „Später am Abend —" oder „Tag 2 · Morgen —"). Pro Moment nur 1–3 Sätze; keine voll ausgespielten Alltagsszenen. Danach fließend in der Zielzeit ankommen. Abwesende Charaktere und Plot State respektieren. Kein Szene-Reset. Natürliche Pause am Ende.]`;
    }
    return `[Steering: The player message directly above is a time skip with fast preview until about ${hint}. Write 2–5 brief interstitial beats — each line opens with a clear time stamp (e.g. "5:40 PM —" or "Later that evening —" or "Day 2 · Morning —"). One to three sentences per beat; no fully played-out daily-life scenes. Then land smoothly at the destination time. Respect absent characters and plot state. No scene reset. End at a natural pause.]`;
  }

  if (locale === "de") {
    return `[Steuerung: Die Spieler-Nachricht direkt darüber ist ein Zeitsprung ohne Schnellvorschau — Ziel: ungefähr ${hint}. Überspringe die Zwischenzeit: ein kurzer Übergang (1–4 Sätze) setzt neue Zeit, Ort und Stimmung; keine Zwischen-Ereignisse ausspielen. Plot-State-Zeit vorwärts setzen. Abwesende Charaktere respektieren. Kein Szene-Reset. Natürliche Pause am Ende.]`;
  }
  return `[Steering: The player message directly above is a time skip without preview — target about ${hint}. Skip the in-between time: a short bridge (1–4 sentences) establishes the new time, place, and mood; do not play out interim events. Advance plot-state time. Respect absent characters. No scene reset. End at a natural pause.]`;
}

export function timeSkipModeFromDisplay(display: string): TimeSkipMode {
  const parsed = parseTimeSkipSteeringDisplay(display);
  return parsed?.mode ?? "direct";
}

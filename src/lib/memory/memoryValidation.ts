/**
 * Phase 7.2: Memory Validation Pass
 *
 * Diagnose-Befund (docs/ENGINE-DIAGNOSIS-2026-06-30.md, Defekt 3):
 *   Plot-State und Timeline werden als zwei separate LLM-Extraktionen gepflegt
 *   und können divergieren. Symptom: "Kaelen ist verletzt im Lazarett" (Plot-State)
 *   vs. "Kaelen kämpft im Thronsaal" (Timeline). Beide werden akzeptiert, das
 *   LLM weiß nicht was gilt, der User sieht eine unkontinuierliche Story.
 *
 * Lösung: Nach jeder Extraktion läuft `validateMemoryConsistency()` mit
 * deklarativen Rules (kein zusätzlicher LLM-Call nötig → billig, deterministisch,
 * kein Over-Correction). Auto-Corrections werden auf das Timeline-JSON angewendet,
 * Konflikte werden gesammelt und können optional per Toast/UI gemeldet werden.
 *
 * Plot-State bleibt IMMER authoritative — wenn die Timeline ihm widerspricht,
 * korrigieren wir die Timeline. Das ist konsistent mit dem "Plot state overrides
 * character card defaults, scenario text, and old countdown tags"-Synapse aus
 * storyMemory.ts.
 */

import type {
  StoryPlotState,
  AbsentCharacter,
  ScheduledEvent,
  PlotThreat,
} from "./plotState";
import type { StoryTimeline, StoryEvent } from "./storyTimeline";
import { eventImportance } from "./storyTimeline";

/** Severity of a single conflict — drives UI presentation. */
export type ConflictSeverity = "info" | "warn" | "error";

/** One detected inconsistency between plot state and timeline. */
export interface MemoryConflict {
  /** Stable id for de-dup / analytics. */
  id: string;
  severity: ConflictSeverity;
  /** Which side wins (we always correct the loser). */
  source: "plot" | "timeline";
  /** Conflict category — maps to a translatable UI string. */
  kind:
    | "actor_absent_but_in_event"
    | "location_mismatch"
    | "time_mismatch"
    | "threat_resolved_but_event_active"
    | "scheduled_event_early_reappearance"
    | "character_state_dead_but_active";
  /** Short German description, ready for the toast. */
  message: string;
  /** Optional: which event was affected (for "open in timeline" link). */
  eventId?: string;
  /** Optional: which character is affected. */
  characterName?: string;
  /** Optional: which threat is affected. */
  threatId?: string;
}

export interface ValidationResult {
  /** Timeline with auto-corrections applied. */
  timeline: StoryTimeline;
  /** Plot state is currently never auto-corrected (LLM is too creative) — but
   *  we still return the input for call-site convenience. */
  plot: StoryPlotState;
  /** All detected conflicts (including the ones that triggered auto-correction). */
  conflicts: MemoryConflict[];
  /** Convenience: was anything actually changed? */
  changed: boolean;
}

/**
 * Validate plot state vs. timeline consistency and apply auto-corrections.
 *
 * Auto-correction policy (deterministic, no LLM):
 *   1. Actor in timeline event but in plotState.absentCharacters
 *      → remove actor from event (unless the event is a "scheduled"-type
 *        marker for the future meeting, in which case we leave it but flag)
 *      → flag severity "warn"
 *   2. Event location contradicts plotState.location
 *      → only auto-correct when event.turnIndex is the latest and event has no
 *        "scheduled" / "time_jump" type. Otherwise just flag.
 *   3. Event in `conflict`/`death` type, but the threat id is referenced and
 *      the threat status is `defeated` or `cancelled`
 *      → demote importance to 0.3 and flag "info"
 *   4. Timeline event with `actors` containing a character flagged `dead` in
 *      resolvedFacts (heuristic: "X ist tot" / "X starb" / "X was killed")
 *      → remove from actors, flag "error"
 *   5. Time mismatch: event.inStoryTime is way ahead of plotState.timeLabel
 *      (we can't detect "behind" reliably) — flag "info", no auto-correct.
 *
 * @param plot   - freshly extracted plot state (authoritative)
 * @param tl     - freshly extracted timeline (will be auto-corrected in place)
 * @param opts   - tunables (thresholds, killing)
 */
export function validateMemoryConsistency(
  plot: StoryPlotState,
  tl: StoryTimeline,
  opts: { now?: Date; killPhraseRegex?: RegExp[] } = {},
): ValidationResult {
  const now = opts.now ?? new Date();
  const conflicts: MemoryConflict[] = [];

  // Mutable working copy — we don't want side effects on caller's ref.
  const corrected: StoryTimeline = {
    ...tl,
    events: tl.events.map((e) => ({ ...e, actors: [...e.actors] })),
  };

  // ---------- 0. Build lookup tables ----------
  const absentByName = new Map<string, AbsentCharacter>();
  for (const a of plot.absentCharacters) {
    if (a.name) absentByName.set(normalizeName(a.name), a);
  }
  const scheduledParticipants = new Set<string>();
  for (const s of plot.scheduledEvents ?? []) {
    for (const p of s.participants ?? []) {
      scheduledParticipants.add(normalizeName(p));
    }
  }
  const threatById = new Map<string, PlotThreat>();
  for (const t of plot.threats ?? []) {
    if (t.id) threatById.set(t.id, t);
  }
  // Heuristic: detect "dead" characters from resolvedFacts phrasing.
  // We don't store a separate `dead: [...]` field — we'd have to add one.
  // Instead, we treat resolvedFacts as authoritative for who died.
  const deadByName = new Set<string>();
  const defaultKillPhrases: RegExp[] = [
    /\b(?:starb|gestorben|getötet|ermordet|verstorben|tot)\b/i,
    /\b(?:died|dead|killed|murdered|slain)\b/i,
  ];
  const killRegexes = opts.killPhraseRegex ?? defaultKillPhrases;
  for (const fact of plot.resolvedFacts ?? []) {
    // Pattern: "<Name> ... starb" or "starb ... <Name>"
    // Cheap heuristic: split on common verbs, take nearby capitalized token.
    for (const re of killRegexes) {
      const m = re.exec(fact);
      if (m) {
        // Find a capitalized name in the same sentence.
        const sentenceStart = fact.lastIndexOf(".", Math.max(0, m.index - 60)) + 1;
        const sentenceEnd = fact.indexOf(".", m.index);
        const sentence = fact.slice(sentenceStart, sentenceEnd > 0 ? sentenceEnd : undefined);
        const nameMatch = /[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?/.exec(sentence);
        if (nameMatch) deadByName.add(normalizeName(nameMatch[0]));
        break;
      }
    }
  }

  // ---------- 1. Walk events and apply corrections ----------
  for (let i = 0; i < corrected.events.length; i++) {
    const e = corrected.events[i];

    // 1A. Actor in event but in absentCharacters
    const offenders: string[] = [];
    for (const actor of e.actors) {
      const n = normalizeName(actor);
      if (absentByName.has(n)) offenders.push(actor);
    }
    if (offenders.length > 0 && e.type !== "scheduled") {
      // Remove offenders from actors (unless the event is ABOUT their absence —
      // i.e. "character_leave" type). For "character_leave" we keep them as
      // historical record but still flag.
      if (e.type !== "character_leave") {
        corrected.events[i] = {
          ...e,
          actors: e.actors.filter((a) => !offenders.includes(a)),
        };
      }
      for (const name of offenders) {
        const c: MemoryConflict = {
          id: `actor_absent:${e.id}:${name}`,
          severity: "warn",
          source: "plot",
          kind: "actor_absent_but_in_event",
          message: `„${name}“ ist im Plot-State abwesend, trat aber im Timeline-Event "${e.summary}" auf — wurde aus den Akteuren entfernt.`,
          eventId: e.id,
          characterName: name,
        };
        conflicts.push(c);
      }
    }

    // 1B. Actor in event but in scheduledEvents (might reappear too early)
    //    — only flag, do not auto-correct (player can override).
    if (e.type !== "scheduled" && e.type !== "character_join") {
      for (const actor of e.actors) {
        const n = normalizeName(actor);
        if (scheduledParticipants.has(n)) {
          conflicts.push({
            id: `scheduled_early:${e.id}:${actor}`,
            severity: "info",
            source: "plot",
            kind: "scheduled_event_early_reappearance",
            message: `„${actor}“ hat ein geplantes Treffen, erscheint aber bereits im Timeline-Event "${e.summary}".`,
            eventId: e.id,
            characterName: actor,
          });
        }
      }
    }

    // 1C. Dead character in event actors
    const deadOffenders: string[] = [];
    for (const actor of e.actors) {
      if (deadByName.has(normalizeName(actor))) deadOffenders.push(actor);
    }
    if (deadOffenders.length > 0) {
      corrected.events[i] = {
        ...e,
        actors: e.actors.filter((a) => !deadOffenders.includes(a)),
      };
      for (const name of deadOffenders) {
        conflicts.push({
          id: `dead_active:${e.id}:${name}`,
          severity: "error",
          source: "plot",
          kind: "character_state_dead_but_active",
          message: `„${name}“ ist laut Plot-State tot, tritt aber im Timeline-Event "${e.summary}" auf — wurde aus den Akteuren entfernt.`,
          eventId: e.id,
          characterName: name,
        });
      }
    }

    // 2. Location mismatch — only auto-correct the most recent event with a
    //    non-trivial location conflict. Older events are historical, so a
    //    location change between them and now is expected.
    if (
      e.location &&
      plot.location &&
      e.location.toLowerCase() !== plot.location.toLowerCase() &&
      e.turnIndex >= lastMeaningfulTurnIndex(corrected.events) - 1 &&
      e.type !== "scheduled" &&
      e.type !== "time_jump"
    ) {
      // Don't auto-correct — location could be intentionally "in transit" or
      // an inner scene. Just flag, leave the decision to the user / LLM.
      conflicts.push({
        id: `location:${e.id}`,
        severity: "warn",
        source: "plot",
        kind: "location_mismatch",
        message: `Ort-Konflikt: Plot-State sagt „${plot.location}“, Timeline-Event sagt „${e.location}".`,
        eventId: e.id,
      });
    }

    // 3. Conflict/death event with a resolved threat — demote importance.
    if (
      (e.type === "conflict" || e.type === "death" || e.type === "resolved") &&
      e.actors.length > 0
    ) {
      for (const actor of e.actors) {
        // Try to find a threat whose label or id mentions this actor.
        for (const t of plot.threats ?? []) {
          if (t.status !== "defeated" && t.status !== "cancelled") continue;
          const hay = `${t.id} ${t.label}`.toLowerCase();
          if (hay.includes(actor.toLowerCase())) {
            const newImp = Math.min(eventImportance(e), 0.3);
            if (newImp !== eventImportance(e)) {
              corrected.events[i] = { ...e, importance: newImp };
              conflicts.push({
                id: `threat_resolved:${e.id}:${t.id}`,
                severity: "info",
                source: "plot",
                kind: "threat_resolved_but_event_active",
                message: `Bedrohung „${t.label}" ist besiegt — Wichtigkeit des Events auf ${(newImp * 100).toFixed(0)}% reduziert.`,
                eventId: e.id,
                threatId: t.id,
              });
            }
            break;
          }
        }
      }
    }
  }

  // ---------- 4. Time-mismatch summary (info-only) ----------
  if (
    plot.timeLabel &&
    tl.currentTime &&
    plot.timeLabel.toLowerCase() !== tl.currentTime.toLowerCase()
  ) {
    conflicts.push({
      id: `time:${now.toISOString()}`,
      severity: "info",
      source: "plot",
      kind: "time_mismatch",
      message: `Zeit-Drift: Plot-State „${plot.timeLabel}", Timeline „${tl.currentTime}". Plot-State gewinnt.`,
    });
  }

  // Update the timeline's currentTime to match plot state (authoritative).
  if (plot.timeLabel && tl.currentTime !== plot.timeLabel) {
    corrected.currentTime = plot.timeLabel;
  }
  corrected.updatedAt = now.toISOString();

  // Detect "changed" by comparing actor arrays & importance values.
  const changed =
    conflicts.length > 0 &&
    (conflicts.some(
      (c) =>
        c.kind === "actor_absent_but_in_event" ||
        c.kind === "character_state_dead_but_active",
    ) ||
      JSON.stringify(corrected.events) !== JSON.stringify(tl.events));

  return {
    timeline: corrected,
    plot,
    conflicts,
    changed,
  };
}

// ---------- helpers ----------

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function lastMeaningfulTurnIndex(events: StoryEvent[]): number {
  let max = 0;
  for (const e of events) {
    if (e.turnIndex > max) max = e.turnIndex;
  }
  return max;
}

/**
 * Convenience for callers: run validation and split the result into
 * `{ correctedTimeline, conflicts }` so the existing call sites don't have
 * to thread the wrapper type.
 */
export function validateAndCorrect(
  plot: StoryPlotState,
  tl: StoryTimeline,
  opts?: { now?: Date; killPhraseRegex?: RegExp[] },
): { correctedTimeline: StoryTimeline; conflicts: MemoryConflict[]; changed: boolean } {
  const r = validateMemoryConsistency(plot, tl, opts);
  return {
    correctedTimeline: r.timeline,
    conflicts: r.conflicts,
    changed: r.changed,
  };
}

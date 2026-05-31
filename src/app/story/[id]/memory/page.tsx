"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";
import {
  getStoryOverview,
  getTurns,
  updateStorySettings,
} from "@/lib/db/stories";
import { extractPlotState, PlotStateExtractError } from "@/lib/memory/plotState";
import {
  EMPTY_PLOT_STATE,
  isPlotStateEmpty,
  isPlotStatePlaceholder,
  type AbsentCharacter,
  type PlotThreat,
  type ScheduledEvent,
  type StoryPlotState,
  type ThreatStatus,
} from "@/lib/memory/plotState";
import { newStoryPin, type StoryPin } from "@/lib/memory/storyPins";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";
import { formatLlmLimitError } from "@/components/LlmUsagePanel";
import type { ChatTurn } from "@/lib/types";

const THREAT_STATUSES: ThreatStatus[] = [
  "active",
  "defeated",
  "avoided",
  "cancelled",
  "unknown",
];

function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function listToLines(items: string[]): string {
  return items.join("\n");
}

function formatAbsentLines(items: AbsentCharacter[]): string {
  return items
    .map((a) =>
      [a.name, a.reason, a.location ?? "", a.returnsWhen ?? ""]
        .map((p) => p.trim())
        .join(" | "),
    )
    .join("\n");
}

function parseAbsentLines(text: string): AbsentCharacter[] {
  const out: AbsentCharacter[] = [];
  for (const line of linesToList(text)) {
    const [name, reason, location, returnsWhen] = line
      .split("|")
      .map((p) => p.trim());
    if (!name || !reason) continue;
    out.push({
      name,
      reason,
      location: location || undefined,
      returnsWhen: returnsWhen || undefined,
    });
  }
  return out;
}

function formatScheduledLines(items: ScheduledEvent[]): string {
  return items
    .map((e) =>
      [
        e.when,
        e.participants.join(", "),
        e.location ?? "",
        e.note ?? "",
      ]
        .map((p) => p.trim())
        .join(" | "),
    )
    .join("\n");
}

function parseScheduledLines(text: string): ScheduledEvent[] {
  const out: ScheduledEvent[] = [];
  for (const line of linesToList(text)) {
    const [when, participants, location, note] = line
      .split("|")
      .map((p) => p.trim());
    if (!when || !participants) continue;
    const parts = participants
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) continue;
    out.push({
      when,
      participants: parts,
      location: location || undefined,
      note: note || undefined,
    });
  }
  return out;
}

function turnsToChat(
  turns: Awaited<ReturnType<typeof getTurns>>,
): ChatTurn[] {
  return turns.map((t) => ({
    role: t.role as ChatTurn["role"],
    content: t.content,
    speakerSlug: t.speaker_slug,
  }));
}

export default function StoryMemoryPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState<string | null>(null);

  const [plot, setPlot] = useState<StoryPlotState>({ ...EMPTY_PLOT_STATE });
  const [pins, setPins] = useState<StoryPin[]>([]);
  const [newPinText, setNewPinText] = useState("");

  const [presentText, setPresentText] = useState("");
  const [absentText, setAbsentText] = useState("");
  const [scheduledText, setScheduledText] = useState("");
  const [resolvedText, setResolvedText] = useState("");
  const [threadsText, setThreadsText] = useState("");
  const [publicText, setPublicText] = useState("");

  const load = useCallback(async () => {
    const overview = await getStoryOverview(storyId);
    const active = overview.chapters.find((c) => c.status === "active");
    setActiveChapterId(active?.id ?? null);
    setChapterTitle(active?.title ?? null);

    const ps = overview.storySettings.plotState ?? { ...EMPTY_PLOT_STATE };
    setPlot(ps);
    setPresentText(listToLines(ps.presentCharacters));
    setAbsentText(formatAbsentLines(ps.absentCharacters ?? []));
    setScheduledText(formatScheduledLines(ps.scheduledEvents ?? []));
    setResolvedText(listToLines(ps.resolvedFacts));
    setThreadsText(listToLines(ps.openThreads));
    setPublicText(listToLines(ps.publicKnowledge));

    setPins(overview.storySettings.pinnedNotes ?? []);
  }, [storyId]);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        load()
          .catch((e) => setError(String(e)))
          .finally(() => setLoading(false));
      });
  }, [load, router]);

  const buildPlotFromForm = (): StoryPlotState => ({
    ...plot,
    presentCharacters: linesToList(presentText),
    absentCharacters: parseAbsentLines(absentText),
    scheduledEvents: parseScheduledLines(scheduledText),
    resolvedFacts: linesToList(resolvedText),
    openThreads: linesToList(threadsText),
    publicKnowledge: linesToList(publicText),
    updatedAt: new Date().toISOString(),
  });

  const savePlotAndPins = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const nextPlot = buildPlotFromForm();
      await updateStorySettings(storyId, {
        plotState: isPlotStateEmpty(nextPlot) ? null : nextPlot,
        pinnedNotes: pins,
      });
      setPlot(nextPlot);
    } catch (e) {
      setError(formatLlmLimitError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const refreshPlotFromAi = async () => {
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setError("OpenRouter-Key in Settings fehlt.");
      return;
    }
    if (!activeChapterId) {
      setError("Kein aktives Kapitel — nichts zum Auslesen.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const rows = await getTurns(activeChapterId);
      if (!rows.length) {
        setError("Aktives Kapitel hat noch keine Nachrichten.");
        return;
      }
      const updated = await extractPlotState(
        settings,
        turnsToChat(rows),
        buildPlotFromForm(),
        { chapterTitle: chapterTitle ?? undefined, strict: true },
      );
      setPlot(updated);
      setPresentText(listToLines(updated.presentCharacters));
      setAbsentText(formatAbsentLines(updated.absentCharacters ?? []));
      setScheduledText(formatScheduledLines(updated.scheduledEvents ?? []));
      setResolvedText(listToLines(updated.resolvedFacts));
      setThreadsText(listToLines(updated.openThreads));
      setPublicText(listToLines(updated.publicKnowledge));
      await updateStorySettings(storyId, {
        plotState: updated,
      });
      setNotice("Plot-State aus aktivem Kapitel übernommen und gespeichert.");
    } catch (e) {
      if (e instanceof PlotStateExtractError && e.rawPreview) {
        setError(
          `${formatLlmLimitError(e.message)}\n\nKI-Ausschnitt:\n${e.rawPreview}`,
        );
      } else {
        setError(formatLlmLimitError(e instanceof Error ? e.message : String(e)));
      }
    } finally {
      setBusy(false);
    }
  };

  const addThreat = () => {
    const id = `threat_${Date.now()}`;
    setPlot((p) => ({
      ...p,
      threats: [
        ...p.threats,
        { id, label: "Neue Bedrohung", status: "active", detail: "" },
      ],
    }));
  };

  const updateThreat = (id: string, patch: Partial<PlotThreat>) => {
    setPlot((p) => ({
      ...p,
      threats: p.threats.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const removeThreat = (id: string) => {
    setPlot((p) => ({
      ...p,
      threats: p.threats.filter((t) => t.id !== id),
    }));
  };

  const addPin = () => {
    const text = newPinText.trim();
    if (!text) return;
    setPins((prev) => [...prev, newStoryPin(text)]);
    setNewPinText("");
  };

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-zinc-400">
        Laden …
      </main>
    );
  }

  const plotEmpty = isPlotStateEmpty(buildPlotFromForm());

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Story-Gedächtnis" backHref={`/story/${storyId}`} />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 pb-10">
        <p className="text-xs text-zinc-500">
          Plot-State und Pinnpunkte manuell pflegen. Figuren-Erinnerungen findest
          du unter Cast → Figuren &amp; Erinnerungen.
        </p>

        <section className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-accent">Plot-State</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={refreshPlotFromAi}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-40"
              >
                Von KI (aktives Kapitel)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={savePlotAndPins}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
              >
                Speichern
              </button>
            </div>
          </div>

          {plotEmpty ? (
            <p className="mb-3 text-xs text-amber-200/90">
              Noch leer oder nur „Unknown“ — trage Zeit/Ort/Bedrohungen ein oder
              nutze „Von KI“.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              Zeit (in-story)
              <input
                value={plot.timeLabel}
                onChange={(e) =>
                  setPlot((p) => ({ ...p, timeLabel: e.target.value }))
                }
                placeholder="z. B. Dienstag Abend, 8h nach der Schlacht"
                className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Ort
              <input
                value={plot.location}
                onChange={(e) =>
                  setPlot((p) => ({ ...p, location: e.target.value }))
                }
                placeholder="z. B. Sicherheitsraum, U-Boot"
                className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
          </div>

          <label className="mt-3 block text-xs text-zinc-400">
            Anwesende Figuren (eine pro Zeile — physisch in der Szene)
            <textarea
              value={presentText}
              onChange={(e) => setPresentText(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>

          <label className="mt-3 block text-xs text-zinc-400">
            Abwesende Figuren (eine pro Zeile: Name | Grund | Ort | Rückkehr)
            <textarea
              value={absentText}
              onChange={(e) => setAbsentText(e.target.value)}
              rows={2}
              placeholder="z. B. Naya | ging nach Hause | Hafen | morgen früh am Tor"
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>

          <label className="mt-3 block text-xs text-zinc-400">
            Geplante Termine (eine pro Zeile: Wann | Wer | Ort | Notiz)
            <textarea
              value={scheduledText}
              onChange={(e) => setScheduledText(e.target.value)}
              rows={2}
              placeholder="z. B. morgen früh | Naya, Marcus | Stadttor | Plan besprechen"
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">
                Bedrohungen
              </span>
              <button
                type="button"
                onClick={addThreat}
                className="text-xs text-accent underline"
              >
                + Bedrohung
              </button>
            </div>
            <ul className="space-y-2">
              {plot.threats.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-surface-border bg-surface p-2"
                >
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={t.label}
                      onChange={(e) =>
                        updateThreat(t.id, { label: e.target.value })
                      }
                      className="min-w-0 flex-1 rounded border border-surface-border bg-surface-raised px-2 py-1 text-xs"
                      placeholder="Name"
                    />
                    <select
                      value={t.status}
                      onChange={(e) =>
                        updateThreat(t.id, {
                          status: e.target.value as ThreatStatus,
                        })
                      }
                      className="rounded border border-surface-border bg-surface-raised px-2 py-1 text-xs"
                    >
                      {THREAT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeThreat(t.id)}
                      className="text-xs text-red-400"
                    >
                      ×
                    </button>
                  </div>
                  <input
                    value={t.detail ?? ""}
                    onChange={(e) =>
                      updateThreat(t.id, { detail: e.target.value })
                    }
                    placeholder="Kurzdetail"
                    className="mt-1 w-full rounded border border-surface-border bg-surface-raised px-2 py-1 text-xs"
                  />
                </li>
              ))}
            </ul>
          </div>

          <label className="mt-3 block text-xs text-zinc-400">
            Erledigte Fakten (eine pro Zeile)
            <textarea
              value={resolvedText}
              onChange={(e) => setResolvedText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
          <label className="mt-3 block text-xs text-zinc-400">
            Offene Fäden (eine pro Zeile)
            <textarea
              value={threadsText}
              onChange={(e) => setThreadsText(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
          <label className="mt-3 block text-xs text-zinc-400">
            Öffentliches Wissen / NPCs (eine pro Zeile)
            <textarea
              value={publicText}
              onChange={(e) => setPublicText(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>

          {!plotEmpty &&
          (isPlotStatePlaceholder(plot.timeLabel) ||
            isPlotStatePlaceholder(plot.location)) ? (
            <p className="mt-2 text-[10px] text-zinc-500">
              Tipp: Leere „Unknown“-Felder und trage echte Werte ein — sonst
              ignoriert die KI sie im Prompt.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-2 text-sm font-medium text-accent">
            Pinnpunkte (für später)
          </h2>
          <p className="mb-3 text-xs text-zinc-500">
            Feste Merkpunkte, die der Erzähler nicht vergessen soll — z. B.
            „Flotte zerstört“, „Naya kennt das Geheimnis“.
          </p>
          <ul className="mb-3 space-y-2">
            {pins.map((p) => (
              <li
                key={p.id}
                className="flex gap-2 rounded-lg border border-surface-border bg-surface px-2 py-1.5"
              >
                <textarea
                  value={p.text}
                  onChange={(e) =>
                    setPins((prev) =>
                      prev.map((x) =>
                        x.id === p.id ? { ...x, text: e.target.value } : x,
                      ),
                    )
                  }
                  rows={2}
                  className="min-w-0 flex-1 resize-none bg-transparent text-xs text-zinc-200"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPins((prev) => prev.filter((x) => x.id !== p.id))
                  }
                  className="shrink-0 text-xs text-red-400"
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={newPinText}
              onChange={(e) => setNewPinText(e.target.value)}
              placeholder="Neuer Pinnpunkt …"
              className="flex-1 rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPin();
                }
              }}
            />
            <button
              type="button"
              onClick={addPin}
              className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs text-accent"
            >
              Anpinnen
            </button>
          </div>
        </section>

        <button
          type="button"
          disabled={busy}
          onClick={savePlotAndPins}
          className="rounded-xl bg-accent py-3 text-center text-sm font-medium text-black disabled:opacity-40"
        >
          Plot &amp; Pinnpunkte speichern
        </button>

        {notice ? <p className="text-sm text-green-400/90">{notice}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <Link
          href={`/story/${storyId}`}
          className="text-center text-xs text-zinc-500 underline"
        >
          Zurück zur Story
        </Link>
      </div>
    </main>
  );
}

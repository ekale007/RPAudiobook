"use client";

import type {
  LlmPricingEntry,
  ProviderPricingPayload,
  TtsPricingEntry,
  TtsPricingUnit,
} from "@/lib/server/providerPricing";

function ttsUnitLabel(unit: TtsPricingUnit): string {
  switch (unit) {
    case "per_1k_chars":
      return "pro 1k Zeichen";
    case "per_1m_bytes":
      return "pro 1 Mio. Bytes";
    case "per_1k_blocks":
      return "pro 1k Blöcke";
    default:
      return unit;
  }
}

type Draft = {
  llm: Array<{
    id: string;
    label: string;
    promptCentsPer1k: string;
    completionCentsPer1k: string;
    markupPercent: string;
  }>;
  tts: Array<{
    key: string;
    label: string;
    unit: TtsPricingEntry["unit"];
    usdCost: string;
    markupPercent: string;
  }>;
};

export function draftFromProviderPricing(
  pricing: ProviderPricingPayload,
): Draft {
  return {
    llm: pricing.llm.map((m) => ({
      id: m.id,
      label: m.label,
      promptCentsPer1k: String(m.promptCentsPer1k),
      completionCentsPer1k: String(m.completionCentsPer1k),
      markupPercent: String(m.markupPercent),
    })),
    tts: pricing.tts.map((t) => ({
      key: t.key,
      label: t.label,
      unit: t.unit,
      usdCost: String(t.usdCost),
      markupPercent: String(t.markupPercent),
    })),
  };
}

export function parseProviderPricingDraft(
  draft: Draft,
): ProviderPricingPayload | { error: string } {
  const llm: LlmPricingEntry[] = [];
  for (const row of draft.llm) {
    const promptCentsPer1k = Number.parseFloat(
      row.promptCentsPer1k.replace(",", "."),
    );
    const completionCentsPer1k = Number.parseFloat(
      row.completionCentsPer1k.replace(",", "."),
    );
    const markupPercent = Number.parseFloat(
      row.markupPercent.replace(",", "."),
    );
    if (
      !row.id.trim() ||
      !Number.isFinite(promptCentsPer1k) ||
      !Number.isFinite(completionCentsPer1k) ||
      promptCentsPer1k < 0 ||
      completionCentsPer1k < 0
    ) {
      return { error: `LLM ${row.id || "?"}: ungültige Kosten` };
    }
    if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 500) {
      return { error: `LLM ${row.id}: Markup 0–500 %` };
    }
    llm.push({
      id: row.id.trim(),
      label: row.label.trim() || row.id.trim(),
      promptCentsPer1k,
      completionCentsPer1k,
      markupPercent,
    });
  }

  const tts: TtsPricingEntry[] = [];
  for (const row of draft.tts) {
    const usdCost = Number.parseFloat(row.usdCost.replace(",", "."));
    const markupPercent = Number.parseFloat(
      row.markupPercent.replace(",", "."),
    );
    if (!Number.isFinite(usdCost) || usdCost < 0) {
      return { error: `TTS ${row.key}: ungültige USD-Kosten` };
    }
    if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 500) {
      return { error: `TTS ${row.key}: Markup 0–500 %` };
    }
    tts.push({
      key: row.key,
      label: row.label,
      unit: row.unit,
      usdCost,
      markupPercent,
    });
  }

  return { llm, tts };
}

export function AdminProviderPricingSection({
  draft,
  onChange,
  onSave,
  busy,
  disabled,
}: {
  draft: Draft | null;
  onChange: (next: Draft) => void;
  onSave: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  if (!draft) return null;

  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <h2 className="mb-1 text-sm font-medium text-accent">
        LLM & TTS — Kosten + Markup
      </h2>
      <p className="mb-3 text-xs text-zinc-500">
        LLM: Cent pro 1k Tokens (Fallback wenn OpenRouter keinen USD-Preis
        liefert). TTS: USD laut Anbieter-Einheit — z. B.{" "}
        <a
          href="https://elevenlabs.io/pricing/api"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline"
        >
          ElevenLabs API
        </a>
        . Markup wird auf die Nutzer-Abrechnung aufgeschlagen (nach USD→EUR).
      </p>

      <h3 className="mb-2 text-xs font-medium text-zinc-300">LLM-Modelle</h3>
      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="px-2 py-1">Modell</th>
              <th className="px-2 py-1">Prompt ¢/1k</th>
              <th className="px-2 py-1">Antwort ¢/1k</th>
              <th className="px-2 py-1">Markup %</th>
            </tr>
          </thead>
          <tbody>
            {draft.llm.map((row, i) => (
              <tr key={row.id} className="border-t border-surface-border/50">
                <td className="max-w-[12rem] px-2 py-1.5">
                  <div className="truncate font-medium text-zinc-300">
                    {row.label}
                  </div>
                  <div className="truncate text-[10px] text-zinc-600">
                    {row.id}
                  </div>
                </td>
                {(["promptCentsPer1k", "completionCentsPer1k", "markupPercent"] as const).map(
                  (field) => (
                    <td key={field} className="px-2 py-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={busy || disabled}
                        value={row[field]}
                        onChange={(e) => {
                          const next = { ...draft };
                          next.llm = [...draft.llm];
                          next.llm[i] = {
                            ...row,
                            [field]: e.target.value,
                          };
                          onChange(next);
                        }}
                        className="w-20 rounded border border-surface-border bg-surface px-1.5 py-1 text-zinc-200"
                      />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 text-xs font-medium text-zinc-300">TTS-Anbieter</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="px-2 py-1">Anbieter</th>
              <th className="px-2 py-1">USD</th>
              <th className="px-2 py-1">Markup %</th>
            </tr>
          </thead>
          <tbody>
            {draft.tts.map((row, i) => (
              <tr key={row.key} className="border-t border-surface-border/50">
                <td className="px-2 py-1.5">
                  <div className="font-medium text-zinc-300">{row.label}</div>
                  <div className="text-[10px] text-zinc-600">
                    {ttsUnitLabel(row.unit)}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={busy || disabled}
                    value={row.usdCost}
                    onChange={(e) => {
                      const next = { ...draft };
                      next.tts = [...draft.tts];
                      next.tts[i] = { ...row, usdCost: e.target.value };
                      onChange(next);
                    }}
                    className="w-24 rounded border border-surface-border bg-surface px-1.5 py-1 text-zinc-200"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={busy || disabled}
                    value={row.markupPercent}
                    onChange={(e) => {
                      const next = { ...draft };
                      next.tts = [...draft.tts];
                      next.tts[i] = {
                        ...row,
                        markupPercent: e.target.value,
                      };
                      onChange(next);
                    }}
                    className="w-20 rounded border border-surface-border bg-surface px-1.5 py-1 text-zinc-200"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        disabled={busy || disabled}
        onClick={onSave}
        className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
      >
        Preise speichern
      </button>
    </section>
  );
}

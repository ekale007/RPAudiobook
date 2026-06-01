"use client";

import { useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { QwenVoiceEditor } from "@/components/QwenVoiceEditor";
import { emptyQwenProfile } from "@/lib/tts/qwenVoiceProfiles";
import type { QwenVoiceProfile } from "@/lib/types";
import { QWEN_VOICES } from "@/lib/tts/qwenVoices";

export default function QwenVoicesLabPage() {
  const [locale, setLocale] = useState<"de" | "en">("de");
  const [profile, setProfile] = useState<QwenVoiceProfile>(() =>
    emptyQwenProfile("narrator"),
  );
  const [customSlug, setCustomSlug] = useState("test-character");

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Qwen Stimmen-Labor" backHref="/settings" />
      <div className="flex flex-col gap-4 p-4">
        <p className="text-xs text-zinc-500">
          Preset-Stimmen + <strong className="text-zinc-300">instruct</strong>{" "}
          für Stimmung. Kein Voice-Cloning — dafür schnell testen. Server:{" "}
          <code className="text-accent">npm run tts:qwen</code>
        </p>

        <div className="flex gap-2">
          {(["de", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              className={`flex-1 rounded-lg py-2 text-sm ${
                locale === l
                  ? "bg-accent text-black"
                  : "border border-surface-border text-zinc-400"
              }`}
            >
              {l === "de" ? "Deutsch" : "English"}
            </button>
          ))}
        </div>

        <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-3 text-sm font-medium text-accent">Editor</h2>
          <QwenVoiceEditor
            profile={profile}
            onChange={setProfile}
            locale={locale}
          />
        </section>

        <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-2 text-sm font-medium text-zinc-300">
            Alle Presets ({QWEN_VOICES.length})
          </h2>
          <ul className="flex flex-col gap-1 text-xs text-zinc-500">
            {QWEN_VOICES.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="text-left text-accent hover:underline"
                  onClick={() =>
                    setProfile((p) => ({
                      ...p,
                      presetSpeaker: v.id,
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                >
                  {v.label}
                </button>
                {" — "}
                {v.hint} ({v.language})
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-dashed border-surface-border p-3 text-xs text-zinc-500">
          <p className="mb-2">
            Für Cast pro Story:{" "}
            <Link href="/" className="text-accent underline">
              Story öffnen
            </Link>{" "}
            → Figuren-Stimmen.
          </p>
          <label className="mb-1 block text-[10px] text-zinc-600">
            Test-Slug (nur Anzeige)
          </label>
          <input
            value={customSlug}
            onChange={(e) => {
              const slug = e.target.value;
              setCustomSlug(slug);
              setProfile((p) => ({ ...p, slug }));
            }}
            className="w-full rounded border border-surface-border bg-surface px-2 py-1 text-xs"
          />
        </section>
      </div>
    </main>
  );
}

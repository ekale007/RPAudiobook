"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";
import {
  listCharacters,
  parseStorySettings,
  updateStorySettings,
} from "@/lib/db/stories";
import { KOKORO_VOICES } from "@/lib/tts/kokoroVoices";
import { mergeVoiceMap } from "@/lib/tts/defaultVoiceMap";
import type { VoiceMap } from "@/lib/types";

export default function StoryVoicesPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [cast, setCast] = useState<
    Awaited<ReturnType<typeof listCharacters>>
  >([]);
  const [voiceMap, setVoiceMap] = useState<VoiceMap>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: auth }) => {
        if (!auth.user) {
          router.replace("/login");
          return;
        }
        Promise.all([
          listCharacters(storyId),
          createClient()
            .from("stories")
            .select("settings")
            .eq("id", storyId)
            .single(),
        ])
          .then(([chars, storyRes]) => {
            if (storyRes.error) throw storyRes.error;
            const settings = parseStorySettings(storyRes.data.settings);
            setCast(chars);
            setVoiceMap(mergeVoiceMap(settings.voiceMap));
          })
          .catch((e) => setError(String(e)));
      });
  }, [storyId, router]);

  const narrator = cast.find((c) => c.role === "narrator");
  const speakers = [
    { slug: "narrator", name: narrator?.name ?? "Narrator" },
    ...cast
      .filter((c) => c.role === "cast")
      .map((c) => ({ slug: c.slug, name: c.name })),
  ];

  const save = async () => {
    setError(null);
    try {
      await updateStorySettings(storyId, { voiceMap });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Character voices" backHref={`/story/${storyId}`} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <p className="text-xs text-zinc-500">
          Kokoro voice per speaker (group chat + multi-voice listen). Uses your
          local TTS server from Settings.
        </p>

        <ul className="flex flex-col gap-3">
          {speakers.map((s) => (
            <li
              key={s.slug}
              className="rounded-xl border border-surface-border bg-surface-raised p-3"
            >
              <p className="mb-2 text-sm font-medium text-zinc-200">{s.name}</p>
              <p className="mb-2 text-xs text-zinc-600">{s.slug}</p>
              <select
                value={voiceMap[s.slug] ?? "af_bella"}
                onChange={(e) =>
                  setVoiceMap((prev) => ({
                    ...prev,
                    [s.slug]: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
              >
                {KOKORO_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.id})
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={save}
          className="rounded-xl bg-accent py-3 font-medium text-black"
        >
          Save voices
        </button>
        {saved ? (
          <p className="text-center text-xs text-green-400">Saved</p>
        ) : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <Link
          href="/settings"
          className="text-center text-xs text-accent underline"
        >
          TTS server settings
        </Link>
      </div>
    </main>
  );
}

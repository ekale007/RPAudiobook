"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";
import { getStoryOverview, type CharacterRow } from "@/lib/db/stories";
import {
  loadTtsSettings,
  saveTtsSettings,
  type TtsSettings,
} from "@/lib/storage/ttsSettings";
import {
  parsePronunciationLines,
  serializePronunciationMap,
} from "@/lib/tts/pronunciation";
import {
  buildCastPronunciationSuggestions,
  isKokoroEngine,
} from "@/lib/tts/kokoroPronunciation";
import { prepareTextForTts } from "@/lib/tts/prepareTtsText";
import { getNarratorAudio } from "@/lib/tts/narratorTts";

export default function StoryPronunciationPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [tts, setTts] = useState<TtsSettings>(() => loadTtsSettings());
  const [text, setText] = useState(
    `Naya looks at Elias. "Kaelen is right. We only have thirty-six hours."`,
  );
  const [speaker, setSpeaker] = useState("narrator");
  const [pronunciationText, setPronunciationText] = useState("");
  const [cast, setCast] = useState<CharacterRow[]>([]);
  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(async ({ data }) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        const overview = await getStoryOverview(storyId);
        setCast(overview.cast.filter((c) => c.role === "cast"));
        const current = loadTtsSettings();
        setTts(current);
        setPronunciationText(
          serializePronunciationMap(current.pronunciationMap ?? {}),
        );
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));

    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [router, storyId]);

  const speakerOptions = useMemo(
    () => [
      { slug: "narrator", name: "Narrator" },
      ...cast.map((c) => ({ slug: c.slug, name: c.name })),
    ],
    [cast],
  );

  const savePronunciation = () => {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const next = {
        ...tts,
        pronunciationMap: parsePronunciationLines(pronunciationText),
      };
      saveTtsSettings(next);
      setTts(next);
      setOk("Aussprache gespeichert.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const playPreview = async () => {
    setPlaying(true);
    setError(null);
    setOk(null);
    try {
      const normalized = prepareTextForTts(text, speaker, cast);
      const { blob: audio } = await getNarratorAudio(tts, normalized, {
        speakerSlug: speaker,
        cast,
      });
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(audio);
      urlRef.current = url;
      const player = new Audio(url);
      audioRef.current = player;
      await player.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlaying(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-zinc-400">
        Laden …
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Aussprache-Zentrale" backHref={`/story/${storyId}`} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-2 text-sm font-medium text-accent">
            Phonetische Namen
          </h2>
          <p className="mb-2 text-xs text-zinc-500">
            Format: <code>Name =&gt; Aussprache</code> (eine Zeile pro Eintrag).
            {isKokoroEngine(tts) ? (
              <>
                {" "}
                Kokoro: volle Charakterkartentitel als Quelle (z. B.{" "}
                <code>Lucifer — The Devil =&gt; Lucifer</code>) und Betonung per
                Großbuchstaben (<code>NaYa</code>, <code>KaALean</code>).
              </>
            ) : (
              <>
                {" "}
                Tipp: ein kompaktes Laut-Wort oder Silbentrennung mit Bindestrich.
              </>
            )}
          </p>
          <textarea
            value={pronunciationText}
            onChange={(e) => setPronunciationText(e.target.value)}
            rows={7}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
            placeholder={
              isKokoroEngine(tts)
                ? `Lucifer — The Devil => Lucifer\nKaelen => KaALean\nNaya => NaYa`
                : `Elias => Eh-LEE-as\nNaya => NAI-ya\nKaelen => KAY-len`
            }
          />
          <button
            type="button"
            onClick={() =>
              setPronunciationText(buildCastPronunciationSuggestions(cast, tts))
            }
            className="mb-2 w-full rounded-lg border border-surface-border py-2 text-xs text-zinc-300 hover:bg-surface"
          >
            Vorschlag aus Cast {isKokoroEngine(tts) ? "(Kokoro)" : ""} laden
          </button>
          <button
            type="button"
            onClick={savePronunciation}
            disabled={saving}
            className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {saving ? "Speichern …" : "Aussprache speichern"}
          </button>
        </section>

        <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-2 text-sm font-medium text-accent">
            Direkt testen
          </h2>
          <label className="mb-1 block text-xs text-zinc-400">Sprecher</label>
          <select
            value={speaker}
            onChange={(e) => setSpeaker(e.target.value)}
            className="mb-3 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
          >
            {speakerOptions.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="mb-1 block text-xs text-zinc-400">Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={playPreview}
            disabled={playing || !text.trim()}
            className="mt-3 w-full rounded-lg border border-accent/40 bg-accent/10 py-2 text-sm font-medium text-accent disabled:opacity-50"
          >
            {playing ? "Spiele …" : "Test abspielen"}
          </button>
        </section>

        {ok ? <p className="text-sm text-green-400">{ok}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </main>
  );
}


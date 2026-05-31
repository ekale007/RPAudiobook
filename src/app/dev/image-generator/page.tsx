"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { uploadCharacterAvatar } from "@/lib/db/characterAvatarStorage";
import {
  listCharacters,
  updateCharacterCard,
  type CharacterRow,
} from "@/lib/db/stories";
import {
  setStoryCoverPath,
  uploadStoryCover,
} from "@/lib/db/storyCoverStorage";
import { setAvatarStoragePath } from "@/lib/images/characterAvatar";
import {
  buildCharacterPortraitPrompt,
  IMAGE_GEN_KINDS,
  IMAGE_GEN_SIZES,
  type ImageGenKind,
  withStylePrefix,
} from "@/lib/images/imagePromptPresets";
import {
  checkLocalImageGenHealth,
  generateLocalImage,
} from "@/lib/images/localImageGen";
import { getLibraryTemplate } from "@/lib/story/libraryTemplates";
import { createClient } from "@/lib/supabase/client";

function DevImageGeneratorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = searchParams.get("storyId") ?? "";
  const characterId = searchParams.get("characterId") ?? "";
  const templateId = searchParams.get("templateId") ?? "";
  const initialKind = (searchParams.get("mode") === "portrait"
    ? "portrait"
    : "cover") as ImageGenKind;

  const [userId, setUserId] = useState<string | null>(null);
  const [kind, setKind] = useState<ImageGenKind>(initialKind);
  const [prompt, setPrompt] = useState("");
  const [seed, setSeed] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [serverHint, setServerHint] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterRow | null>(null);

  const sizes = IMAGE_GEN_SIZES[kind];

  const refreshHealth = useCallback(async () => {
    const health = await checkLocalImageGenHealth();
    setServerOk(health.ok);
    setServerHint(health.ok ? health.engine ?? "sdxl-turbo" : health.error ?? null);
  }, []);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        setUserId(data.user.id);
      });
    refreshHealth();
  }, [router, refreshHealth]);

  useEffect(() => {
    if (!storyId || !characterId) {
      setCharacter(null);
      return;
    }
    listCharacters(storyId)
      .then((rows) => setCharacter(rows.find((c) => c.id === characterId) ?? null))
      .catch((e) => setError(String(e)));
  }, [storyId, characterId]);

  useEffect(() => {
    if (templateId) {
      const t = getLibraryTemplate(
        templateId as import("@/lib/story/libraryTemplates").LibraryTemplateId,
      );
      if (t?.coverImagePrompt) {
        setKind("cover");
        setPrompt(t.coverImagePrompt);
      }
      return;
    }
    if (characterId && character) {
      setKind("portrait");
      setPrompt(
        buildCharacterPortraitPrompt({
          name: character.name,
          description: character.card_json.description,
          personality: character.card_json.personality,
          scenario: character.card_json.scenario,
        }),
      );
    }
  }, [templateId, characterId, character?.id, character?.name]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fullPrompt = useMemo(
    () => withStylePrefix(kind, prompt),
    [kind, prompt],
  );

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const blob = await generateLocalImage({
        prompt: fullPrompt,
        kind,
        seed: seed.trim() ? Number(seed) : null,
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewBlob(blob);
      setMessage("Bild generiert.");
      await refreshHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await refreshHealth();
    } finally {
      setBusy(false);
    }
  };

  const saveStoryCover = async () => {
    if (!previewBlob || !userId || !storyId) return;
    setSaveBusy(true);
    setError(null);
    try {
      const path = await uploadStoryCover(userId, storyId, previewBlob);
      if (!path) throw new Error("Cover-Upload fehlgeschlagen");
      await setStoryCoverPath(storyId, path);
      setMessage("Als Story-Cover gespeichert.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  };

  const saveCharacterAvatar = async () => {
    if (!previewBlob || !userId || !storyId || !character) return;
    setSaveBusy(true);
    setError(null);
    try {
      const path = await uploadCharacterAvatar(
        userId,
        storyId,
        character.id,
        previewBlob,
      );
      if (!path) throw new Error("Avatar-Upload fehlgeschlagen");
      const nextCard = setAvatarStoragePath(character.card_json, path);
      await updateCharacterCard(character.id, storyId, nextCard);
      setCharacter({ ...character, card_json: nextCard });
      setMessage(`Avatar für „${character.name}“ gespeichert.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  };

  const downloadImage = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = kind === "cover" ? "cover.webp" : "portrait.webp";
    a.click();
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader
        title="Bildgenerator (lokal)"
        backHref={storyId ? `/story/${storyId}` : "/"}
      />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
        <p className="text-xs leading-relaxed text-zinc-500">
          Nur lokal: SDXL-Turbo über{" "}
          <code className="text-zinc-400">npm run images:server</code>. Cover
          768×1152, Porträt 768×768 als WebP.
        </p>

        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            serverOk
              ? "border-green-800/50 bg-green-950/30 text-green-300"
              : serverOk === false
                ? "border-amber-800/50 bg-amber-950/30 text-amber-200"
                : "border-surface-border bg-surface-raised text-zinc-400"
          }`}
        >
          {serverOk === null
            ? "Server-Status wird geprüft …"
            : serverOk
              ? `Bild-Server bereit (${serverHint}). Erstes Bild lädt das Modell (~30–90 s).`
              : serverHint ?? "Bild-Server offline"}
        </div>

        <div className="flex flex-wrap gap-2">
          {IMAGE_GEN_KINDS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                kind === id
                  ? "bg-accent text-black"
                  : "border border-surface-border text-zinc-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {character ? (
          <p className="text-xs text-zinc-400">
            Figur: <span className="text-zinc-200">{character.name}</span>
          </p>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-relaxed text-zinc-100"
            placeholder={
              kind === "cover"
                ? "Szenenbeschreibung für das Buchcover …"
                : "Name, Aussehen, Stimmung der Figur …"
            }
          />
        </label>

        <p className="text-[10px] leading-relaxed text-zinc-600">
          Stil-Präfix wird automatisch ergänzt. Vorschau: {sizes.width}×
          {sizes.height}, {sizes.steps} Steps.
        </p>

        <label className="flex max-w-[12rem] flex-col gap-1">
          <span className="text-xs text-zinc-500">Seed (optional)</span>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            placeholder="z. B. 42"
          />
        </label>

        <button
          type="button"
          disabled={busy || !prompt.trim()}
          onClick={handleGenerate}
          className="rounded-lg bg-accent py-2.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {busy ? "Generiere … (kann ~1 Min dauern)" : "Generieren"}
        </button>

        {previewUrl ? (
          <section className="rounded-lg border border-surface-border bg-surface-raised p-3">
            <h2 className="mb-2 text-xs font-medium text-zinc-400">Vorschau</h2>
            <div className="flex flex-col items-start gap-3 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Generiertes Bild"
                className={
                  kind === "cover"
                    ? "max-h-80 w-auto rounded-md ring-1 ring-surface-border"
                    : "h-48 w-48 rounded-full object-cover ring-1 ring-surface-border"
                }
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadImage}
                  className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs text-accent"
                >
                  Herunterladen
                </button>
                {storyId && userId ? (
                  <button
                    type="button"
                    disabled={saveBusy || kind !== "cover"}
                    onClick={saveStoryCover}
                    className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent disabled:opacity-40"
                  >
                    Als Story-Cover
                  </button>
                ) : null}
                {storyId && userId && character ? (
                  <button
                    type="button"
                    disabled={saveBusy || kind !== "portrait"}
                    onClick={saveCharacterAvatar}
                    className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent disabled:opacity-40"
                  >
                    Als Char-Avatar
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {storyId ? (
          <Link
            href={`/story/${storyId}/cards`}
            className="text-xs text-zinc-500 underline"
          >
            Zurück zu Charakterkarten
          </Link>
        ) : null}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {message ? <p className="text-sm text-accent">{message}</p> : null}
      </div>
    </main>
  );
}

export default function DevImageGeneratorPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
        <p className="text-zinc-400">
          Der lokale Bildgenerator ist nur in der Entwicklungsumgebung verfügbar.
        </p>
        <Link href="/" className="mt-4 text-sm text-accent underline">
          Startseite
        </Link>
      </main>
    );
  }

  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center text-zinc-400">
          Laden …
        </main>
      }
    >
      <DevImageGeneratorInner />
    </Suspense>
  );
}

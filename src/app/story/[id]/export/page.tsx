"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useStorySession } from "@/lib/story/useStorySession";
import { listCharacters, listLorebooksForStory } from "@/lib/db/stories";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StoryExportPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;
  const [ready, setReady] = useState(false);
  const [chars, setChars] = useState<
    Array<{ slug: string; card_json: unknown }>
  >([]);
  const [books, setBooks] = useState<
    Array<{ slug: string; book_json: unknown }>
  >([]);

  const { authReady } = useStorySession(router);

  useEffect(() => {
    if (!authReady) return;
    Promise.all([listCharacters(storyId), listLorebooksForStory(storyId)])
      .then(([c, b]) => {
        setChars(c.map((x) => ({ slug: x.slug, card_json: x.card_json })));
        setBooks(
          b.map((x) => ({
            slug: x.slug as string,
            book_json: x.book_json,
          })),
        );
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [authReady, storyId]);

  const exportAll = () => {
    for (const c of chars) {
      downloadJson(`${c.slug}.json`, c.card_json);
    }
    for (const b of books) {
      downloadJson(`${b.slug}.json`, b.book_json);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Export" backHref={`/story/${storyId}`} />
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-zinc-400">
          Download character-card JSON files for SillyTavern or backup.
        </p>
        {!ready ? (
          <p className="text-zinc-500">Loading…</p>
        ) : (
          <>
            <button
              type="button"
              onClick={exportAll}
              className="rounded-xl bg-accent py-3 font-medium text-black"
            >
              Download all ({chars.length + books.length} files)
            </button>
            <ul className="text-sm text-zinc-500">
              {chars.map((c) => (
                <li key={c.slug}>
                  <button
                    type="button"
                    className="text-accent underline"
                    onClick={() => downloadJson(`${c.slug}.json`, c.card_json)}
                  >
                    {c.slug}.json
                  </button>
                </li>
              ))}
              {books.map((b) => (
                <li key={b.slug}>
                  <button
                    type="button"
                    className="text-accent underline"
                    onClick={() => downloadJson(`${b.slug}.json`, b.book_json)}
                  >
                    {b.slug}.json
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

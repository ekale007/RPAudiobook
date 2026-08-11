"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/supabase/authFetch";
import type { FishPublicVoiceEntry } from "@/app/api/tts/fish/public/route";

type LangFilter = "all" | "de" | "en" | string;

const ATTR_FILTERS: Array<{ id: string; label: string; tags: string[] }> = [
  { id: "all", label: "Alle", tags: [] },
  { id: "male", label: "Männlich", tags: ["male"] },
  { id: "female", label: "Weiblich", tags: ["female"] },
  { id: "deep", label: "Tief", tags: ["deep"] },
  { id: "warm", label: "Warm", tags: ["warm"] },
  { id: "energetic", label: "Energetisch", tags: ["energetic", "high-energy"] },
  { id: "calm", label: "Ruhig", tags: ["calm", "soft", "gentle"] },
  { id: "narrator", label: "Erzähler", tags: ["narrator", "storytelling"] },
  {
    id: "character",
    label: "Charakter",
    tags: ["character-voice", "movie", "gaming", "cartoon"],
  },
];

export function FishPublicVoiceSelect({
  value,
  onChange,
  storyLocale,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (voiceId: string) => void;
  storyLocale?: "de" | "en" | string | null;
  disabled?: boolean;
  className?: string;
}) {
  const [voices, setVoices] = useState<FishPublicVoiceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [langFilter, setLangFilter] = useState<LangFilter>(
    storyLocale === "de" ? "de" : storyLocale === "en" ? "en" : "all",
  );
  const [attrFilter, setAttrFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: "50",
        });
        if (langFilter !== "all") params.set("language", langFilter);
        params.set("sort", "likes");
        const res = await authFetch(`/api/tts/fish/public?${params.toString()}`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          voices: FishPublicVoiceEntry[];
          hasMore: boolean;
        };
        setVoices((prev) =>
          replace ? json.voices : [...prev, ...json.voices],
        );
        setHasMore(json.hasMore);
        setPage(nextPage);
      } finally {
        setLoading(false);
      }
    },
    [langFilter],
  );

  useEffect(() => {
    void load(1, true);
  }, [load]);

  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setAudioUrl(null);
  };

  useEffect(() => () => stopPreview(), []);

  const playPreview = (url: string) => {
    stopPreview();
    if (url === audioUrl) return;
    setAudioUrl(url);
    const audio = new Audio(url);
    audio.play().catch(() => {});
    audioRef.current = audio;
  };

  const attrTags = ATTR_FILTERS.find((a) => a.id === attrFilter)?.tags ?? [];
  const filtered = voices.filter((v) => {
    if (attrTags.length && !attrTags.some((t) => v.tags.includes(t))) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (
        !v.label.toLowerCase().includes(q) &&
        !v.description.toLowerCase().includes(q) &&
        !v.tags.some((t) => t.includes(q))
      )
        return false;
    }
    return true;
  });

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <select
          value={langFilter}
          onChange={(e) => {
            setLangFilter(e.target.value);
            void load(1, true);
          }}
          disabled={disabled}
          className="rounded-lg border border-surface-border bg-surface px-1.5 py-1 text-[10px]"
          aria-label="Sprache"
        >
          <option value="all">Alle Sprachen</option>
          <option value="de">Deutsch</option>
          <option value="en">Englisch</option>
          <option value="zh">Chinesisch</option>
          <option value="ja">Japanisch</option>
          <option value="es">Spanisch</option>
          <option value="fr">Französisch</option>
        </select>
        <select
          value={attrFilter}
          onChange={(e) => setAttrFilter(e.target.value)}
          disabled={disabled}
          className="rounded-lg border border-surface-border bg-surface px-1.5 py-1 text-[10px]"
          aria-label="Attribut"
        >
          {ATTR_FILTERS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        placeholder="Stimme suchen (Name, Beschreibung, Tag)…"
        className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1 text-[11px]"
      />
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-surface-border bg-surface-raised/50 p-1">
        {loading && !voices.length ? (
          <p className="px-2 py-1 text-[10px] text-zinc-600">Lade Stimmen…</p>
        ) : null}
        {!loading && !filtered.length ? (
          <p className="px-2 py-1 text-[10px] text-zinc-600">
            Keine Stimmen gefunden — Filter ändern.
          </p>
        ) : null}
        {filtered.map((v) => (
          <div
            key={v.id}
            className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 ${
              value === v.id ? "bg-accent/20" : "hover:bg-surface"
            }`}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(v.id)}
              className="min-w-0 flex-1 text-left"
              title={v.description || v.label}
            >
              <p className="truncate text-[11px] text-zinc-200">
                {v.label}
              </p>
              <p className="truncate text-[9px] text-zinc-600">
                {v.languages.join(", ")} · ♥ {v.likes.toLocaleString("de")}
                {v.tags.length ? ` · ${v.tags.slice(0, 3).join(", ")}` : ""}
              </p>
            </button>
            {v.previewUrl ? (
              <button
                type="button"
                onClick={() => playPreview(v.previewUrl!)}
                className="shrink-0 rounded-md border border-surface-border px-1.5 py-0.5 text-[10px] text-accent"
                title="Vorschau anhören"
              >
                {audioUrl === v.previewUrl ? "■" : "▶"}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {hasMore ? (
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => void load(page + 1, false)}
          className="w-full rounded-lg border border-surface-border py-1 text-[10px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
        >
          {loading ? "Lädt…" : "Mehr laden"}
        </button>
      ) : null}
    </div>
  );
}
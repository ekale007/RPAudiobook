"use client";

import { useEffect, useState } from "react";
import { getStoryCoverSignedUrl } from "@/lib/db/storyCoverStorage";
import {
  getLibraryCoverGradient,
  getLibraryCoverImageSrc,
} from "@/lib/story/libraryTemplates";

export function StoryCover({
  title,
  coverStoragePath,
  coverImageSrc,
  libraryTemplateId,
  className = "",
  aspectClass = "aspect-[3/4]",
  compact = false,
}: {
  title: string;
  coverStoragePath?: string | null;
  /** Bundled /public path — overrides library template default when set */
  coverImageSrc?: string | null;
  libraryTemplateId?: string | null;
  className?: string;
  aspectClass?: string;
  compact?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const staticSrc =
    coverImageSrc ??
    getLibraryCoverImageSrc(libraryTemplateId) ??
    null;

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!coverStoragePath) return;
    getStoryCoverSignedUrl(coverStoragePath).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [coverStoragePath]);

  const imageSrc = url ?? staticSrc ?? null;
  const gradient =
    getLibraryCoverGradient(libraryTemplateId) ??
    "linear-gradient(135deg, #2a2a32 0%, #1a1a22 100%)";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-surface-border bg-surface-raised ${aspectClass} ${className}`}
      style={!imageSrc ? { background: gradient } : undefined}
      aria-hidden={!title}
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : compact ? (
        <span className="sr-only">{title}</span>
      ) : (
        <div className="flex h-full w-full flex-col justify-end p-3">
          <span className="line-clamp-3 text-sm font-semibold leading-snug text-white/90 drop-shadow">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getCharacterAvatarSignedUrl } from "@/lib/db/characterAvatarStorage";
import { getHoerbuchkiExtensions } from "@/lib/images/characterAvatar";

export function CharacterAvatar({
  name,
  avatarStoragePath,
  className = "h-12 w-12",
}: {
  name: string;
  avatarStoragePath?: string | null;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!avatarStoragePath) {
      setUrl(null);
      return;
    }
    getCharacterAvatarSignedUrl(avatarStoragePath).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarStoragePath]);

  const initial = (name.trim()[0] ?? "?").toUpperCase();

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`shrink-0 rounded-full object-cover ring-1 ring-surface-border ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-zinc-400 ring-1 ring-surface-border ${className}`}
      aria-hidden
    >
      {initial}
    </span>
  );
}
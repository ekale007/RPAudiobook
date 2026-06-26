"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { updateStorySettings } from "@/lib/db/stories";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { ui } from "@/lib/ui/classes";

function EditLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={`${ui.card} flex items-center gap-2 px-2.5 py-2 active:scale-[0.99]`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-zinc-200">{title}</p>
        <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
          {description}
        </p>
      </div>
      <span className="shrink-0 text-base text-zinc-600" aria-hidden>
        ›
      </span>
    </Link>
  );
}

export function StoryHubEditSection({
  storyId,
  storyConcept,
  onConceptSaved,
}: {
  storyId: string;
  storyConcept: string | null;
  onConceptSaved?: () => void;
}) {
  const { t } = useUiLocale();
  const [draft, setDraft] = useState(storyConcept ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(storyConcept ?? "");
    setSaved(false);
  }, [storyConcept]);

  const dirty = draft.trim() !== (storyConcept ?? "").trim();

  const saveConcept = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateStorySettings(storyId, {
        storyConcept: draft.trim() || null,
      });
      setSaved(true);
      onConceptSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${ui.panel} p-2.5`}>
      <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {t("storyHub.editTitle")}
      </h2>

      <label className="mb-1 block text-[10px] text-zinc-500">
        {t("storyHub.conceptLabel")}
      </label>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setSaved(false);
        }}
        rows={3}
        placeholder={t("storyHub.conceptPlaceholder")}
        className={`${ui.input} mb-2 resize-y text-xs`}
      />
      <div className="mb-2.5 flex items-center gap-2">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => void saveConcept()}
          className={ui.btnPrimary}
        >
          {busy ? t("common.saving") : t("storyHub.conceptSave")}
        </button>
        {saved && !dirty ? (
          <span className="text-[10px] text-green-400/90">{t("common.saved")}</span>
        ) : null}
        {error ? (
          <span className="text-[10px] text-red-400">{error}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <EditLink
          href={`/story/${storyId}/cards`}
          title={t("storyHub.cardsTitle")}
          description={t("storyHub.cardsDesc")}
        />
        <EditLink
          href={`/story/${storyId}/world`}
          title={t("storyHub.worldTitle")}
          description={t("storyHub.worldDesc")}
        />
        <EditLink
          href={`/story/${storyId}/voices`}
          title={t("storyHub.voicesTitle")}
          description={t("storyHub.voicesDesc")}
        />
        <EditLink
          href={`/story/${storyId}/memory`}
          title={t("storyHub.memoryTitle")}
          description={t("storyHub.memoryDesc")}
        />
      </div>
    </section>
  );
}

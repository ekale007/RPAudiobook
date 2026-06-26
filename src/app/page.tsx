"use client";

import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BetaOnboardingModal } from "@/components/BetaOnboardingModal";
import { LegalFooter } from "@/components/legal/LegalFooter";
import {
  StoryLibraryShelf,
  StoryListCard,
} from "@/components/StoryHomeSections";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { LibraryImportProtagonistModal } from "@/components/story-hub/LibraryImportProtagonistModal";
import { LibraryDuplicateImportModal } from "@/components/story-hub/LibraryDuplicateImportModal";
import {
  deleteStory,
  getActiveLibraryImportStory,
  importFromLibraryTemplate,
  isStoryArchived,
  listStories,
  setStoryArchived,
  updateStoryTitle,
  type StoryProtagonistImportSetup,
  type StoryRow,
} from "@/lib/db/stories";
import type { LibraryTemplateId } from "@/lib/story/libraryTemplates";
import { getLibraryTemplateId } from "@/lib/story/storyOrigin";
import {
  isLocalMode,
  localDeploymentUserId,
} from "@/lib/deploymentMode";
import { ui } from "@/lib/ui/classes";
import type { User } from "@supabase/supabase-js";

function StorySkeletonList() {
  return (
    <ul className="flex flex-col gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center gap-2.5 rounded-lg border border-surface-border bg-surface-raised/60 p-2"
        >
          <div className="h-12 w-9 shrink-0 animate-pulse rounded-md bg-surface-border/60" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded bg-surface-border/60" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-surface-border/40" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  const { t } = useUiLocale();
  const localMode = isLocalMode();
  const supabaseOk = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(!localMode);
  const [importingId, setImportingId] = useState<LibraryTemplateId | null>(
    null,
  );
  const [importSetupTemplateId, setImportSetupTemplateId] =
    useState<LibraryTemplateId | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [storiesLoaded, setStoriesLoaded] = useState(false);
  const [busyStoryId, setBusyStoryId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [duplicateImport, setDuplicateImport] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const refreshStories = async (includeArchived = showArchived) => {
    if (!localMode && !user) return;
    const rows = await listStories(includeArchived);
    setStories(rows);
  };

  useEffect(() => {
    if (localMode) {
      setLoading(false);
      return;
    }
    if (!supabaseOk) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [localMode, supabaseOk]);

  useEffect(() => {
    if (localMode) {
      listStories(showArchived)
        .then(setStories)
        .catch((e) => setMessage(String(e)))
        .finally(() => setStoriesLoaded(true));
      return;
    }
    if (!user) return;
    listStories(showArchived)
      .then(setStories)
      .catch((e) => setMessage(String(e)))
      .finally(() => setStoriesLoaded(true));
  }, [localMode, user, showArchived]);

  const handleLibraryImport = async (templateId: LibraryTemplateId) => {
    if (!localMode && !user) return;
    setMessage(null);
    try {
      const existing = await getActiveLibraryImportStory(templateId);
      if (existing) {
        setDuplicateImport(existing);
        return;
      }
      setImportSetupTemplateId(templateId);
    } catch (e) {
      setMessage(String(e));
    }
  };

  const runLibraryImport = async (
    templateId: LibraryTemplateId,
    setup: StoryProtagonistImportSetup,
  ) => {
    const userId = localMode ? localDeploymentUserId() : user?.id;
    if (!userId) return;
    setImportingId(templateId);
    setMessage(null);
    try {
      const { storyId } = await importFromLibraryTemplate(
        userId,
        templateId,
        setup,
      );
      window.location.href = `/story/${storyId}`;
    } catch (e) {
      setMessage(String(e));
      setImportingId(null);
      setImportSetupTemplateId(templateId);
    }
  };

  if (!localMode && !supabaseOk) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader title="" showBrand />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6 text-center">
          <p className="text-sm leading-relaxed text-zinc-300">
            {t("home.supabaseHint")}
          </p>
          <Link href="/settings" className={`${ui.btnAccent} justify-center py-2.5`}>
            {t("nav.settings")}
          </Link>
        </div>
        <LegalFooter className="mt-auto" />
      </main>
    );
  }

  if (!localMode && loading) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader title="" showBrand />
        <div className="mx-auto w-full max-w-3xl flex-1 px-3 pt-3 sm:px-4">
          <div className="mb-3 h-10 animate-pulse rounded-lg bg-surface-raised/70" />
          <StorySkeletonList />
        </div>
      </main>
    );
  }

  if (!localMode && !user) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader title="" showBrand />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 p-6">
          <p className="text-center text-sm leading-relaxed text-zinc-300">
            {t("home.guestPitch")}
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className={`${ui.btnPrimary} justify-center py-2.5 text-sm`}
            >
              {t("home.signIn")}
            </Link>
            <Link
              href="/signup"
              className={`${ui.btn} justify-center py-2.5 text-sm`}
            >
              {t("home.signUp")}
            </Link>
          </div>
        </div>
        <LegalFooter className="mt-auto" />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="" showBrand />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-3 pb-10 pt-3 sm:px-4">
        <div className="mb-3 flex items-center gap-2">
          <Link
            href="/story/new"
            className={`${ui.btnPrimary} flex-1 py-2.5 text-sm`}
          >
            {t("home.newStory")}
          </Link>
          <Link
            href="/story/import"
            className={`${ui.btn} py-2.5 text-sm`}
          >
            {t("home.epub")}
          </Link>
        </div>

        <p className="mb-2 px-0.5 text-[11px] leading-snug text-zinc-500">
          {localMode ? t("home.localModeHint") : t("brand.tagline")}
        </p>

        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
            {t("home.yourStories")}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              aria-pressed={showArchived}
              className={`${ui.btn} px-2 py-1 text-[10px] ${
                showArchived ? "border-accent/50 bg-accent/12 text-accent" : ""
              }`}
            >
              {t("home.archive")}
            </button>
            {!localMode ? (
              <button
                type="button"
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setUser(null);
                  setStories([]);
                }}
                className="px-1 text-[10px] text-zinc-600 transition hover:text-zinc-400"
              >
                {t("home.signOut")}
              </button>
            ) : (
              <span className={ui.chip}>{t("home.localBadge")}</span>
            )}
          </div>
        </div>

        {message ? (
          <p className="mb-2 text-center text-xs text-zinc-400">{message}</p>
        ) : null}

        {!storiesLoaded ? (
          <StorySkeletonList />
        ) : (
        <ul className="flex flex-col gap-1.5">
          {stories.map((s) => (
            <li key={s.id}>
              <StoryListCard
                story={s}
                storySettings={s.settings}
                libraryTemplateId={getLibraryTemplateId(s.settings)}
                busy={busyStoryId === s.id}
                renaming={renamingId === s.id}
                renameDraft={renameDraft}
                onRenameDraftChange={setRenameDraft}
                onStartRename={() => {
                  setRenamingId(s.id);
                  setRenameDraft(s.title);
                }}
                onCancelRename={() => setRenamingId(null)}
                onSaveRename={async () => {
                  setBusyStoryId(s.id);
                  setMessage(null);
                  try {
                    await updateStoryTitle(s.id, renameDraft);
                    setRenamingId(null);
                    await refreshStories();
                  } catch (e) {
                    setMessage(String(e));
                  } finally {
                    setBusyStoryId(null);
                  }
                }}
                onArchive={async () => {
                  setBusyStoryId(s.id);
                  setMessage(null);
                  try {
                    const archived = isStoryArchived(s.settings);
                    await setStoryArchived(s.id, !archived);
                    await refreshStories();
                  } catch (e) {
                    setMessage(String(e));
                  } finally {
                    setBusyStoryId(null);
                  }
                }}
                onDelete={async () => {
                  const ok = window.confirm(
                    t("story.deleteConfirm", { title: s.title }),
                  );
                  if (!ok) return;
                  setBusyStoryId(s.id);
                  setMessage(null);
                  try {
                    await deleteStory(s.id);
                    await refreshStories();
                  } catch (e) {
                    setMessage(String(e));
                  } finally {
                    setBusyStoryId(null);
                  }
                }}
                isArchived={isStoryArchived(s.settings)}
              />
            </li>
          ))}
        </ul>
        )}

        {storiesLoaded && stories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-surface-border/80 px-4 py-6 text-center">
            <p className="text-xs leading-relaxed text-zinc-500">
              {t("home.emptyStories")}
            </p>
          </div>
        ) : null}

        <StoryLibraryShelf
          importingId={importingId}
          onImport={handleLibraryImport}
        />
      </div>

      {importSetupTemplateId ? (
        <LibraryImportProtagonistModal
          templateId={importSetupTemplateId}
          open
          busy={importingId === importSetupTemplateId}
          onClose={() => {
            if (importingId) return;
            setImportSetupTemplateId(null);
          }}
          onConfirm={(setup) => {
            const id = importSetupTemplateId;
            setImportSetupTemplateId(null);
            void runLibraryImport(id, setup);
          }}
        />
      ) : null}

      {duplicateImport ? (
        <LibraryDuplicateImportModal
          open
          storyId={duplicateImport.id}
          storyTitle={duplicateImport.title}
          onClose={() => setDuplicateImport(null)}
        />
      ) : null}

      {!localMode ? <BetaOnboardingModal openGate /> : null}
      <LegalFooter />
    </main>
  );
}

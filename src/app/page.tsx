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
import type { User } from "@supabase/supabase-js";

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
        .catch((e) => setMessage(String(e)));
      return;
    }
    if (!user) return;
    listStories(showArchived)
      .then(setStories)
      .catch((e) => setMessage(String(e)));
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
        <div className="flex flex-1 flex-col justify-center gap-4 p-6 text-center">
          <p className="text-zinc-300">{t("home.supabaseHint")}</p>
          <Link href="/settings" className="text-accent underline">
            {t("nav.settings")}
          </Link>
        </div>
        <LegalFooter className="mt-auto" />
      </main>
    );
  }

  if (!localMode && loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-zinc-400">
        {t("common.loading")}
      </main>
    );
  }

  if (!localMode && !user) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader title="" showBrand />
        <div className="flex flex-1 flex-col justify-center gap-6 p-6">
          <p className="text-center text-sm leading-relaxed text-zinc-300">
            {t("home.guestPitch")}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-accent py-3 text-center font-medium text-black"
            >
              {t("home.signIn")}
            </Link>
            <Link
              href="/signup"
              className="rounded-xl border border-surface-border py-3 text-center text-sm font-medium text-zinc-200"
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
      <AppHeader
        title=""
        showBrand
        centerSlot={
          <div className="flex items-center gap-1.5">
            <Link
              href="/story/import"
              className="whitespace-nowrap rounded-full border border-surface-border px-2.5 py-1.5 text-[10px] font-medium text-zinc-300 sm:px-3 sm:text-[11px]"
            >
              {t("home.epub")}
            </Link>
            <Link
              href="/story/new"
              className="whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-black shadow-sm sm:px-4 sm:text-xs"
            >
              {t("home.newStory")}
            </Link>
          </div>
        }
      />
      <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-8 pt-3 sm:px-4">
        <div className="mb-1 px-1">
          <p className="text-xs text-zinc-500">
            {localMode ? t("home.localModeHint") : t("brand.tagline")}
          </p>
        </div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-200">
            {t("home.yourStories")}
          </h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="scale-90"
              />
              {t("home.archive")}
            </label>
            {!localMode ? (
              <button
                type="button"
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setUser(null);
                  setStories([]);
                }}
                className="text-[10px] text-zinc-600 hover:text-zinc-400"
              >
                {t("home.signOut")}
              </button>
            ) : (
              <span className="text-[10px] text-zinc-600">{t("home.localBadge")}</span>
            )}
          </div>
        </div>

        {message ? (
          <p className="mb-2 text-center text-xs text-zinc-400">{message}</p>
        ) : null}

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

        {stories.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">
            {t("home.emptyStories")}
          </p>
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

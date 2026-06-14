import {
  getLibraryTemplate,
  type LibraryTemplateId,
} from "@/lib/story/libraryTemplates";
import type { StoryCharacterCard } from "@/lib/types";

import type { UILocale } from "@/lib/i18n/types";

export type StoryOrigin = "personal" | "library" | "editor" | "epub";

export function getStoryOrigin(settings: unknown): StoryOrigin {
  const o = (settings ?? {}) as { storyOrigin?: unknown };
  if (
    o.storyOrigin === "library" ||
    o.storyOrigin === "editor" ||
    o.storyOrigin === "epub"
  ) {
    return o.storyOrigin;
  }
  return "personal";
}

export function getLibraryTemplateId(settings: unknown): string | null {
  const o = (settings ?? {}) as { libraryTemplateId?: unknown };
  return typeof o.libraryTemplateId === "string" ? o.libraryTemplateId : null;
}

export function storyOriginLabel(
  origin: StoryOrigin,
  uiLocale: UILocale = "de",
): string {
  const de: Record<StoryOrigin, string> = {
    library: "Bibliothek",
    editor: "Editor",
    epub: "EPUB",
    personal: "Eigene",
  };
  const en: Record<StoryOrigin, string> = {
    library: "Library",
    editor: "Editor",
    epub: "EPUB",
    personal: "Personal",
  };
  return (uiLocale === "en" ? en : de)[origin];
}

/** Story pitch / concept for hub summary (stored or inferred). */
export function getStoryConcept(
  settings: unknown,
  narrator?: StoryCharacterCard | null,
): string | null {
  const o = (settings ?? {}) as { storyConcept?: unknown };
  if (typeof o.storyConcept === "string" && o.storyConcept.trim()) {
    return o.storyConcept.trim();
  }
  const libId = getLibraryTemplateId(settings);
  if (libId) {
    const template = getLibraryTemplate(libId as LibraryTemplateId);
    if (template?.defaultConcept?.trim()) {
      return template.defaultConcept.trim();
    }
  }
  const scenario = narrator?.scenario?.trim();
  if (scenario) return scenario;
  const description = narrator?.description?.trim();
  if (description) return description;
  return null;
}

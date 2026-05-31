import {
  getLibraryTemplate,
  type LibraryTemplateId,
} from "@/lib/story/libraryTemplates";
import type { WryTourCharacter } from "@/lib/types";

export type StoryOrigin = "personal" | "library" | "editor";

export function getStoryOrigin(settings: unknown): StoryOrigin {
  const o = (settings ?? {}) as { storyOrigin?: unknown };
  if (o.storyOrigin === "library" || o.storyOrigin === "editor") {
    return o.storyOrigin;
  }
  return "personal";
}

export function getLibraryTemplateId(settings: unknown): string | null {
  const o = (settings ?? {}) as { libraryTemplateId?: unknown };
  return typeof o.libraryTemplateId === "string" ? o.libraryTemplateId : null;
}

export function storyOriginLabel(origin: StoryOrigin): string {
  switch (origin) {
    case "library":
      return "Bibliothek";
    case "editor":
      return "Editor";
    default:
      return "Eigene";
  }
}

/** Story pitch / concept for hub summary (stored or inferred). */
export function getStoryConcept(
  settings: unknown,
  narrator?: WryTourCharacter | null,
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

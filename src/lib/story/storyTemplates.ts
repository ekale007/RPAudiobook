import type { StorySeedPack } from "@/lib/import/storySeed";
import type { StoryDraft } from "@/lib/story/generateStoryDraft";
import {
  libraryTemplateToDraft,
  PUBLIC_LIBRARY_TEMPLATES,
  type LibraryTemplateId,
} from "@/lib/story/libraryTemplates";
import { seedPackToStoryDraft } from "@/lib/story/seedPackDraft";

export type StoryTemplateId = "none" | LibraryTemplateId;

export interface StoryTemplateDefinition {
  id: StoryTemplateId;
  label: string;
  locale: "de" | "en";
  defaultConcept: string;
  defaultGenre: string;
  defaultTone: string;
  loadPack: () => StorySeedPack;
  toDraft: (pack: StorySeedPack) => StoryDraft;
}

export { seedPackToStoryDraft };

export const STORY_TEMPLATES: StoryTemplateDefinition[] = [
  {
    id: "none",
    label: "— Keine Vorlage —",
    locale: "de",
    defaultConcept: "",
    defaultGenre: "",
    defaultTone: "",
    loadPack: () => ({ characters: [], lorebooks: [] }),
    toDraft: () => ({
      storyTitle: "",
      locale: "de",
      bandTitle: "",
      chapterTitle: "",
      worldLorebook: { name: "", entries: [] },
      characters: [],
    }),
  },
  ...PUBLIC_LIBRARY_TEMPLATES.map((lib) => ({
    id: lib.id as LibraryTemplateId,
    label: lib.title,
    locale: lib.locale,
    defaultConcept: lib.defaultConcept,
    defaultGenre: lib.defaultGenre,
    defaultTone: lib.defaultTone,
    loadPack: lib.loadPack,
    toDraft: () => libraryTemplateToDraft(lib),
  })),
];

export function getStoryTemplate(
  id: StoryTemplateId,
): StoryTemplateDefinition | undefined {
  return STORY_TEMPLATES.find((t) => t.id === id);
}

export function loadTemplateDraft(id: StoryTemplateId): {
  draft: StoryDraft;
  template: StoryTemplateDefinition;
} | null {
  if (id === "none") return null;
  const template = getStoryTemplate(id);
  if (!template) return null;
  const pack = template.loadPack();
  const draft = template.toDraft(pack);
  return { draft, template };
}

export function cloneStoryDraft(draft: StoryDraft): StoryDraft {
  return structuredClone(draft);
}

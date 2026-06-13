import type { CharacterRow } from "@/lib/db/stories";
import { stripRoleplayMarkupForTts } from "@/lib/tts/speakableText";

const SPEAKER_TAG = /<<\s*speaker\s*:\s*[a-z0-9][a-z0-9_:-]*\s*>>/gi;

/** Strip script tags; dialogue voice is chosen via segment overrides, not "X says". */
export function prepareTextForTts(
  content: string,
  _speakerSlug?: string | null,
  _cast?: CharacterRow[],
): string {
  return stripRoleplayMarkupForTts(
    content.replace(SPEAKER_TAG, "").trim(),
  );
}

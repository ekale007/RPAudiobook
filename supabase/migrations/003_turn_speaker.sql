-- Phase D: group chat speakers + per-turn TTS voice

alter table public.turns
  add column if not exists speaker_slug text;

create index if not exists idx_turns_chapter_speaker
  on public.turns (chapter_id, index_in_chapter);

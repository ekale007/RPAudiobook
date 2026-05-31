-- Per-character story memory (discovered cast, archive on death/departure)

alter table public.characters
  add column if not exists status text not null default 'active'
    check (status in ('active', 'archived'));

alter table public.characters
  add column if not exists character_memory text;

alter table public.characters
  add column if not exists archived_at timestamptz;

alter table public.characters
  add column if not exists archived_reason text;

alter table public.characters
  add column if not exists first_seen_chapter_id uuid references public.chapters (id) on delete set null;

create index if not exists idx_characters_story_status
  on public.characters (story_id, status);

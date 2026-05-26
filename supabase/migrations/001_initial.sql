-- HörbuchKI Phase A schema

create extension if not exists "uuid-ossp";

-- Stories
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  locale text not null default 'en',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  story_id uuid references public.stories (id) on delete cascade,
  slug text not null,
  role text not null default 'cast' check (role in ('narrator', 'cast')),
  name text not null,
  card_json jsonb not null,
  created_at timestamptz not null default now()
);

create table public.lorebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  story_id uuid references public.stories (id) on delete cascade,
  slug text not null,
  name text not null,
  book_json jsonb not null,
  created_at timestamptz not null default now()
);

create table public.story_lorebooks (
  story_id uuid not null references public.stories (id) on delete cascade,
  lorebook_id uuid not null references public.lorebooks (id) on delete cascade,
  primary key (story_id, lorebook_id)
);

create table public.bands (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  index_in_story int not null default 1,
  title text not null,
  band_summary text,
  created_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands (id) on delete cascade,
  index_in_band int not null default 1,
  title text not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  chapter_summary text,
  rolling_summary text,
  phase_hint text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.turns (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  index_in_chapter int not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.memory_snapshots (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  kind text not null check (kind in ('rolling', 'chapter', 'band')),
  content text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.stories enable row level security;
alter table public.characters enable row level security;
alter table public.lorebooks enable row level security;
alter table public.story_lorebooks enable row level security;
alter table public.bands enable row level security;
alter table public.chapters enable row level security;
alter table public.turns enable row level security;
alter table public.memory_snapshots enable row level security;

create policy "stories_own" on public.stories for all using (auth.uid() = user_id);
create policy "characters_own" on public.characters for all using (auth.uid() = user_id);
create policy "lorebooks_own" on public.lorebooks for all using (auth.uid() = user_id);

create policy "story_lorebooks_via_story" on public.story_lorebooks for all using (
  exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid())
);

create policy "bands_via_story" on public.bands for all using (
  exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid())
);

create policy "chapters_via_band" on public.chapters for all using (
  exists (
    select 1 from public.bands b
    join public.stories s on s.id = b.story_id
    where b.id = band_id and s.user_id = auth.uid()
  )
);

create policy "turns_via_chapter" on public.turns for all using (
  exists (
    select 1 from public.chapters c
    join public.bands b on b.id = c.band_id
    join public.stories s on s.id = b.story_id
    where c.id = chapter_id and s.user_id = auth.uid()
  )
);

create policy "memory_via_chapter" on public.memory_snapshots for all using (
  exists (
    select 1 from public.chapters c
    join public.bands b on b.id = c.band_id
    join public.stories s on s.id = b.story_id
    where c.id = chapter_id and s.user_id = auth.uid()
  )
);

create index idx_turns_chapter on public.turns (chapter_id, index_in_chapter);
create index idx_chapters_band on public.chapters (band_id, index_in_band);

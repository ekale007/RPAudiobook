-- Per-user app settings (OpenRouter model/temp, TTS voice, etc.)
-- API keys stay in browser localStorage only.

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  open_router jsonb not null default '{}'::jsonb,
  tts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "user_preferences_select_own"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "user_preferences_insert_own"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "user_preferences_update_own"
  on public.user_preferences for update
  using (auth.uid() = user_id);

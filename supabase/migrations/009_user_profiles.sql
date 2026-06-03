-- Beta tiers: free | beta | pro (limits resolved in app + optional overrides)
-- Reihenfolge: nach 008, vor 010 und 011.
-- Supabase warnt „destructive“ wegen `drop trigger` — ersetzt nur den Signup-Trigger, löscht keine Nutzerdaten.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free'
    check (tier in ('free', 'beta', 'pro')),
  display_name text,
  llm_budget_cents_override int check (llm_budget_cents_override is null or llm_budget_cents_override > 0),
  llm_hourly_limit_override int check (llm_hourly_limit_override is null or llm_hourly_limit_override > 0),
  tts_hourly_limit_override int check (tts_hourly_limit_override is null or tts_hourly_limit_override > 0),
  tts_storage_max_override int check (tts_storage_max_override is null or tts_storage_max_override > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "user_profiles_select_own"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "user_profiles_insert_own"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

-- Tier/Overrides: Supabase SQL, service role, oder /admin

-- New signups get a profile row (tier free)
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, tier)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Backfill existing users (run once after migration)
insert into public.user_profiles (user_id, tier)
select id, 'free' from auth.users
on conflict (user_id) do nothing;

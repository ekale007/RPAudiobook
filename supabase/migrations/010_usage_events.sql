-- Per-request usage log (LLM + TTS) for player transparency and admin review.

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('llm', 'tts')),
  status text not null default 'ok' check (status in ('ok', 'error')),
  label text,
  model_id text,
  provider_ref text,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  characters int not null default 0,
  cost_cents int not null default 0,
  provider_cost_usd numeric(12, 6),
  duration_ms int,
  story_id uuid references public.stories (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

alter table public.usage_events enable row level security;

create policy "usage_events_select_own"
  on public.usage_events for select
  using (auth.uid() = user_id);

create or replace function public.insert_usage_event(
  p_kind text,
  p_status text,
  p_label text,
  p_model_id text,
  p_provider_ref text,
  p_prompt_tokens int,
  p_completion_tokens int,
  p_characters int,
  p_cost_cents int,
  p_provider_cost_usd numeric,
  p_duration_ms int,
  p_story_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  p_user_id uuid := auth.uid();
  p_id uuid;
begin
  if p_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.usage_events (
    user_id,
    kind,
    status,
    label,
    model_id,
    provider_ref,
    prompt_tokens,
    completion_tokens,
    characters,
    cost_cents,
    provider_cost_usd,
    duration_ms,
    story_id
  )
  values (
    p_user_id,
    p_kind,
    coalesce(nullif(trim(p_status), ''), 'ok'),
    nullif(trim(p_label), ''),
    nullif(trim(p_model_id), ''),
    nullif(trim(p_provider_ref), ''),
    coalesce(p_prompt_tokens, 0),
    coalesce(p_completion_tokens, 0),
    coalesce(p_characters, 0),
    greatest(coalesce(p_cost_cents, 0), 0),
    p_provider_cost_usd,
    p_duration_ms,
    p_story_id
  )
  returning id into p_id;

  return p_id;
end;
$$;

grant execute on function public.insert_usage_event(
  text, text, text, text, text, int, int, int, int, numeric, int, uuid
) to authenticated;

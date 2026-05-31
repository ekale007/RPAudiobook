-- Beta: per-user LLM usage & estimated cost (cents) per calendar month (UTC).

create table public.user_llm_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_month text not null,
  request_count int not null default 0,
  prompt_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  cost_cents int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_month)
);

alter table public.user_llm_usage enable row level security;

create policy "user_llm_usage_select_own"
  on public.user_llm_usage for select
  using (auth.uid() = user_id);

create or replace function public.increment_llm_usage(
  p_prompt_tokens bigint,
  p_completion_tokens bigint,
  p_cost_cents int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p_month text := to_char(timezone('utc', now()), 'YYYY-MM');
  p_user_id uuid := auth.uid();
begin
  if p_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.user_llm_usage (
    user_id,
    period_month,
    request_count,
    prompt_tokens,
    completion_tokens,
    cost_cents
  )
  values (
    p_user_id,
    p_month,
    1,
    coalesce(p_prompt_tokens, 0),
    coalesce(p_completion_tokens, 0),
    coalesce(p_cost_cents, 0)
  )
  on conflict (user_id, period_month) do update set
    request_count = user_llm_usage.request_count + 1,
    prompt_tokens = user_llm_usage.prompt_tokens + excluded.prompt_tokens,
    completion_tokens = user_llm_usage.completion_tokens + excluded.completion_tokens,
    cost_cents = user_llm_usage.cost_cents + excluded.cost_cents,
    updated_at = now();
end;
$$;

grant execute on function public.increment_llm_usage(bigint, bigint, int) to authenticated;

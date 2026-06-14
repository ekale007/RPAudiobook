-- Wallet (prepaid Guthaben), weekly Free budget, Stripe top-ups (migration 016)

alter table public.user_profiles
  add column if not exists wallet_balance_cents int not null default 0
    check (wallet_balance_cents >= 0),
  add column if not exists stripe_customer_id text,
  add column if not exists beta_welcome_credit_granted boolean not null default false;

create unique index if not exists user_profiles_stripe_customer_id_idx
  on public.user_profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Free tier: complimentary spend per ISO week (UTC), not from wallet
create table if not exists public.user_weekly_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_week text not null,
  cost_cents int not null default 0 check (cost_cents >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_week)
);

alter table public.user_weekly_usage enable row level security;

create policy "user_weekly_usage_select_own"
  on public.user_weekly_usage for select
  using (auth.uid() = user_id);

-- Audit log for credits (Stripe) and debits (usage)
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_cents int not null,
  kind text not null,
  reference text,
  description text,
  balance_after_cents int not null check (balance_after_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions (user_id, created_at desc);

alter table public.wallet_transactions enable row level security;

create policy "wallet_transactions_select_own"
  on public.wallet_transactions for select
  using (auth.uid() = user_id);

-- Stripe webhook idempotency (service_role only — no client policies)
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

-- Monday UTC date key (YYYY-MM-DD) for weekly Free budget
create or replace function public.current_period_week_utc()
returns text
language sql
stable
as $$
  select to_char(
    (timezone('utc', now())::date - ((extract(isodow from timezone('utc', now()))::int - 1) * interval '1 day'))::date,
    'YYYY-MM-DD'
  );
$$;

-- Charge usage: Free weekly bucket first, then wallet (authenticated user)
create or replace function public.charge_usage(p_cost_cents int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p_user_id uuid := auth.uid();
  p_tier text;
  p_wallet int;
  p_week text := public.current_period_week_utc();
  p_weekly_used int := 0;
  p_weekly_budget int := 200;
  p_free_remaining int := 0;
  p_from_free int := 0;
  p_from_wallet int := 0;
  p_cost int := coalesce(p_cost_cents, 0);
  p_new_wallet int;
begin
  if p_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_cost <= 0 then
    return jsonb_build_object(
      'charged_cents', 0,
      'from_free_cents', 0,
      'from_wallet_cents', 0,
      'wallet_balance_cents', 0
    );
  end if;

  select tier, wallet_balance_cents
    into p_tier, p_wallet
  from public.user_profiles
  where user_id = p_user_id
  for update;

  if p_tier is null then
    raise exception 'profile_not_found';
  end if;

  if p_tier = 'free' then
    select coalesce(cost_cents, 0) into p_weekly_used
    from public.user_weekly_usage
    where user_id = p_user_id and period_week = p_week
    for update;

    p_free_remaining := greatest(0, p_weekly_budget - coalesce(p_weekly_used, 0));
    p_from_free := least(p_cost, p_free_remaining);
    p_from_wallet := p_cost - p_from_free;
  else
    p_from_wallet := p_cost;
  end if;

  if p_from_wallet > coalesce(p_wallet, 0) then
    raise exception 'insufficient_balance';
  end if;

  if p_from_free > 0 then
    insert into public.user_weekly_usage (user_id, period_week, cost_cents)
    values (p_user_id, p_week, p_from_free)
    on conflict (user_id, period_week) do update set
      cost_cents = user_weekly_usage.cost_cents + excluded.cost_cents,
      updated_at = now();
  end if;

  if p_from_wallet > 0 then
    update public.user_profiles
    set wallet_balance_cents = wallet_balance_cents - p_from_wallet,
        updated_at = now()
    where user_id = p_user_id;
  end if;

  select wallet_balance_cents into p_new_wallet
  from public.user_profiles
  where user_id = p_user_id;

  if p_from_wallet > 0 then
    insert into public.wallet_transactions (
      user_id, amount_cents, kind, reference, description, balance_after_cents
    ) values (
      p_user_id,
      -p_from_wallet,
      'usage_debit',
      null,
      'API-Verbrauch',
      p_new_wallet
    );
  end if;

  return jsonb_build_object(
    'charged_cents', p_cost,
    'from_free_cents', p_from_free,
    'from_wallet_cents', p_from_wallet,
    'wallet_balance_cents', p_new_wallet
  );
end;
$$;

grant execute on function public.charge_usage(int) to authenticated;

-- Credit wallet (service role — Stripe webhook, admin)
create or replace function public.credit_wallet(
  p_user_id uuid,
  p_amount_cents int,
  p_kind text,
  p_reference text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p_amount int := coalesce(p_amount_cents, 0);
  p_new_balance int;
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  update public.user_profiles
  set wallet_balance_cents = wallet_balance_cents + p_amount,
      updated_at = now()
  where user_id = p_user_id
  returning wallet_balance_cents into p_new_balance;

  if p_new_balance is null then
    raise exception 'profile_not_found';
  end if;

  insert into public.wallet_transactions (
    user_id, amount_cents, kind, reference, description, balance_after_cents
  ) values (
    p_user_id,
    p_amount,
    coalesce(p_kind, 'credit'),
    p_reference,
    p_description,
    p_new_balance
  );

  return jsonb_build_object(
    'wallet_balance_cents', p_new_balance,
    'credited_cents', p_amount
  );
end;
$$;

revoke all on function public.credit_wallet(uuid, int, text, text, text) from public;
grant execute on function public.credit_wallet(uuid, int, text, text, text) to service_role;

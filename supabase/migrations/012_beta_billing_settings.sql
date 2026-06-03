-- Singleton: Wechselkurs & TTS-Tarif (Admin-UI, Fallback: Vercel-Env).



create table if not exists public.beta_billing_settings (

  id smallint primary key default 1 check (id = 1),

  usd_to_eur_rate numeric(10, 6) not null default 0.920000

    check (usd_to_eur_rate > 0 and usd_to_eur_rate <= 5),

  tts_cents_per_1k_chars numeric(10, 4) not null default 9.2000

    check (tts_cents_per_1k_chars >= 0 and tts_cents_per_1k_chars <= 10000),

  updated_at timestamptz not null default now(),

  updated_by uuid references auth.users (id) on delete set null

);



insert into public.beta_billing_settings (id)

values (1)

on conflict (id) do nothing;



alter table public.beta_billing_settings enable row level security;



create policy "beta_billing_settings_select_authenticated"

  on public.beta_billing_settings for select

  to authenticated

  using (true);



-- Schreiben nur über Service Role (Admin-API).



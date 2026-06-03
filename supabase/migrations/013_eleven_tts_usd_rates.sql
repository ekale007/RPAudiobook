-- Eleven API $/1k chars (Flash vs Multilingual/v3) — Admin-UI, siehe elevenlabs.io/pricing/api

alter table public.beta_billing_settings
  add column if not exists tts_usd_per_1k_flash numeric(10, 4) not null default 0.0500
    check (tts_usd_per_1k_flash >= 0 and tts_usd_per_1k_flash <= 100),
  add column if not exists tts_usd_per_1k_standard numeric(10, 4) not null default 0.1000
    check (tts_usd_per_1k_standard >= 0 and tts_usd_per_1k_standard <= 100);

-- Align legacy flat cent default (~$0.10 × 0.92 EUR) for old rows still at 30
update public.beta_billing_settings
set tts_cents_per_1k_chars = 9.2
where id = 1 and tts_cents_per_1k_chars >= 20;

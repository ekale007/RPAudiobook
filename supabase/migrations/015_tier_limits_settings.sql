-- Admin-editable default limits per tier (free | beta | pro).
-- Falls back to env in app when tier_limits is null.

alter table public.beta_billing_settings
  add column if not exists tier_limits jsonb;

comment on column public.beta_billing_settings.tier_limits is
  'Default limits per tier: { "free": { llmBudgetCents, llmPerHour, ttsPerHour, ttsStorageMax, allowedModelIds }, ... }';

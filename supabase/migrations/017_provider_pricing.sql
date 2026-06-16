-- Per-model LLM and per-provider TTS cost + markup (Admin UI).

alter table public.beta_billing_settings
  add column if not exists provider_pricing jsonb;

comment on column public.beta_billing_settings.provider_pricing is
  'LLM/TTS provider cost + markupPercent: { "llm": { "model/id": { promptCentsPer1k, completionCentsPer1k, markupPercent, label? } }, "tts": { "fish": { usdCost, markupPercent, unit, label } } }';

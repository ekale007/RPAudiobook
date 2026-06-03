-- Per-turn cost display in chat (LLM reply + optional TTS).

alter table public.turns
  add column if not exists llm_cost_cents int
    check (llm_cost_cents is null or llm_cost_cents >= 0),
  add column if not exists tts_cost_cents int
    check (tts_cost_cents is null or tts_cost_cents >= 0);

-- Migration 018: hierarchical chapter chunks
--
-- Phase 7.2 of the engine-diagnosis roadmap (docs/ENGINE-DIAGNOSIS-2026-06-30.md,
-- Defekt 1: Rolling-Summary-Drift).
--
-- Adds a JSONB column `chapters.chapter_chunks` that stores append-only
-- chunk summaries (startTurnIndex / endTurnIndex / summary / generatedAt).
-- The rolling summary is then generated from the last few chunks + recent
-- fresh turns instead of a 40 KB single-pass transcript regeneration.
--
-- Backward-compat: The app code (src/lib/memory/chapterChunks.ts +
-- src/lib/db/stories.ts) detects a missing column and falls back to the
-- legacy single-pass path. So this migration is OPTIONAL until you want
-- the new behaviour, but recommended: production data accumulates ~10
-- chunks per chapter, and the old path forgets facts from the beginning
-- of long chapters.
--
-- Apply in the Supabase SQL editor (manual, no CLI on the operator box).

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS chapter_chunks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Index: a GIN index on the JSONB makes future "find chapter by chunk
-- mentioning X" queries fast, but we don't have such queries yet, so
-- this is commented out to avoid index bloat. Uncomment when needed.
-- CREATE INDEX IF NOT EXISTS chapters_chapter_chunks_gin
--   ON public.chapters USING gin (chapter_chunks);

COMMENT ON COLUMN public.chapters.chapter_chunks IS
  'Phase 7.2: append-only hierarchical chapter summary chunks. Array of {startTurnIndex, endTurnIndex, summary, generatedAt}. Used by regenerateRollingSummary to avoid losing old facts.';

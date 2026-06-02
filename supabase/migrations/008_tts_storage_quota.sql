-- Count turns with cloud TTS audio for the current user (RLS-scoped via stories join).
create or replace function public.count_user_tts_recordings()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(count(*)::integer, 0)
  from public.turns t
  inner join public.chapters c on c.id = t.chapter_id
  inner join public.bands b on b.id = c.band_id
  inner join public.stories s on s.id = b.story_id
  where s.user_id = auth.uid()
    and t.audio_storage_path is not null;
$$;

grant execute on function public.count_user_tts_recordings() to authenticated;

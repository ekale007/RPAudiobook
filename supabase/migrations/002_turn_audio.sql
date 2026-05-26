-- Phase B: optional cached TTS path per turn (Supabase Storage)
alter table public.turns
  add column if not exists audio_storage_path text;

-- Storage bucket (run once in Supabase dashboard if insert fails — create bucket "tts-audio" private)
insert into storage.buckets (id, name, public)
values ('tts-audio', 'tts-audio', false)
on conflict (id) do nothing;

create policy "tts_audio_select_own"
on storage.objects for select
using (
  bucket_id = 'tts-audio'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "tts_audio_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'tts-audio'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "tts_audio_update_own"
on storage.objects for update
using (
  bucket_id = 'tts-audio'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "tts_audio_delete_own"
on storage.objects for delete
using (
  bucket_id = 'tts-audio'
  and auth.uid()::text = (storage.foldername(name))[1]
);

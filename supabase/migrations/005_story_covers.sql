-- Story cover images (user-uploaded)
alter table public.stories
  add column if not exists cover_storage_path text;

insert into storage.buckets (id, name, public)
values ('story-covers', 'story-covers', false)
on conflict (id) do nothing;

create policy "story_covers_select_own"
on storage.objects for select
using (
  bucket_id = 'story-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "story_covers_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'story-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "story_covers_update_own"
on storage.objects for update
using (
  bucket_id = 'story-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "story_covers_delete_own"
on storage.objects for delete
using (
  bucket_id = 'story-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

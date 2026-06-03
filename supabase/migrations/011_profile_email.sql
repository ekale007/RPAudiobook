alter table public.user_profiles
  add column if not exists email text;

update public.user_profiles p
set email = u.email
from auth.users u
where u.id = p.user_id and p.email is null;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, tier, email)
  values (new.id, 'free', new.email)
  on conflict (user_id) do update set
    email = coalesce(public.user_profiles.email, excluded.email),
    updated_at = now();
  return new;
end;
$$;

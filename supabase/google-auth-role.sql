create or replace function public.complete_google_account_registration(p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
begin
  if authenticated_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if p_role is null or p_role not in ('customer', 'business_owner') then
    raise exception 'Invalid account type';
  end if;

  if auth.jwt() -> 'app_metadata' ->> 'provider' is distinct from 'google' then
    raise exception 'Google authentication is required';
  end if;

  insert into public.profiles (id, full_name, role, avatar_url)
  select
    auth_user.id,
    coalesce(auth_user.raw_user_meta_data ->> 'full_name', auth_user.raw_user_meta_data ->> 'name'),
    p_role,
    coalesce(auth_user.raw_user_meta_data ->> 'avatar_url', auth_user.raw_user_meta_data ->> 'picture')
  from auth.users as auth_user
  where auth_user.id = authenticated_user_id
  on conflict (id) do update
  set
    role = excluded.role,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  if not found then
    raise exception 'Authenticated user was not found';
  end if;
end;
$$;

revoke all on function public.complete_google_account_registration(text) from public;
grant execute on function public.complete_google_account_registration(text) to authenticated;

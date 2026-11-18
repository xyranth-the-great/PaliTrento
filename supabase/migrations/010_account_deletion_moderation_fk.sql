-- Moderation history authored by a deleted account should not prevent account
-- deletion. Target history already cascades when the target account is removed.
do $$
declare
  constraint_name text;
begin
  if to_regclass('public.account_moderation_actions') is null then
    return;
  end if;

  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.account_moderation_actions'::regclass
      and c.contype = 'f'
      and a.attname = 'actor_user_id'
  loop
    execute format(
      'alter table public.account_moderation_actions drop constraint %I',
      constraint_name
    );
  end loop;

  alter table public.account_moderation_actions
    add constraint account_moderation_actions_actor_user_id_fkey
    foreign key (actor_user_id) references auth.users(id) on delete cascade;
end;
$$;

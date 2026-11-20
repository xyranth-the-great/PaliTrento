-- REVIEW BEFORE RUNNING.
create or replace function public.protect_lgu_srp_ceiling()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then return new; end if;
  if tg_op = 'INSERT' then
    new.lgu_srp_ceiling := null;
  else
    new.lgu_srp_ceiling := old.lgu_srp_ceiling;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_lgu_srp_ceiling on public.products;
create trigger trg_protect_lgu_srp_ceiling
before insert or update on public.products
for each row execute function public.protect_lgu_srp_ceiling();

-- Run after orders.sql and chat.sql to let chat participants see the buyer's name.

create or replace function public.get_order_customer_name(p_order_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.full_name
  from public.orders as order_row
  join public.stores as store on store.id = order_row.store_id
  join public.profiles as profile on profile.id = order_row.buyer_id
  where order_row.id = p_order_id
    and (
      order_row.buyer_id = (select auth.uid())
      or store.user_id = (select auth.uid())
    )
  limit 1;
$$;

revoke all on function public.get_order_customer_name(uuid) from public, anon;
grant execute on function public.get_order_customer_name(uuid) to authenticated;

notify pgrst, 'reload schema';

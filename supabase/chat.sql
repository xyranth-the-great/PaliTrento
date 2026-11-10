-- Messages table for buyer-seller chat (per order)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_order_idx on messages (order_id, created_at);
create index if not exists messages_sender_idx on messages (sender_id);

-- RLS
alter table messages enable row level security;

-- Drop existing policies first
drop policy if exists "participant read messages" on messages;
drop policy if exists "participant send messages" on messages;

-- Participants can read messages for their orders
create policy "participant read messages" on messages
  for select to authenticated
  using (
    order_id in (
      select id from orders
      where buyer_id = auth.uid()
      or store_id in (select id from stores where user_id = auth.uid())
    )
  );

-- Participants can send messages
create policy "participant send messages" on messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and order_id in (
      select id from orders
      where buyer_id = auth.uid()
      or store_id in (select id from stores where user_id = auth.uid())
    )
  );

-- Enable Realtime for messages
alter publication supabase_realtime add table messages;
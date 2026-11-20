-- Allow 'CLOTHING' as a valid store trade_category in public.stores
alter table public.stores drop constraint if exists stores_trade_category_check;
alter table public.stores
  add constraint stores_trade_category_check
  check (
    trade_category in (
      'SARI_SARI',
      'CARINDERIA',
      'FRESH_PRODUCE',
      'PHARMACY',
      'CLOTHING',
      'SERVICES',
      'PRODUCT',
      'AGRI'
    )
  );

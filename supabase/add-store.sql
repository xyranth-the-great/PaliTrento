-- Run in Supabase: SQL Editor > New query > paste > Run
-- Adds: BEKIK traveller's KAMBINGAN and native chicken (CARINDERIA)

insert into stores (
  trn_code, business_name, trade_category, proprietor_name, contact_number,
  barangay, purok, landmark_reference, lat, lng,
  bmbe_registered, dti_registered, srp_compliant, verification_status,
  open_time, close_time, accepted_payments
) values (
  'TRN-2026-090',
  'BEKIK traveller''s KAMBINGAN and native chicken',
  'CARINDERIA',
  'bekik',
  '+639777452391',
  'Poblacion',
  'Purok 5',
  'near D.O Plaza Park',
  8.040985350038843,
  126.06412133170487,
  true,
  true,
  false,
  'PENDING',
  '00:00',
  '23:59',
  '{CASH,GCASH}'
)
on conflict (trn_code) do nothing;

insert into products (store_id, name, category, unit, current_price, lgu_srp_ceiling, in_stock)
select s.id, v.name, v.cat, v.unit, v.price, v.cap::numeric, true
from (values
  ('TRN-2026-090', 'Kambing stew', 'Meals', 'PC', 80, null),
  ('TRN-2026-090', 'Native chicken tinola', 'Meals', 'PC', 120, null),
  ('TRN-2026-090', 'Rice', 'Staples', 'PC', 20, null)
) as v(trn, name, cat, unit, price, cap)
join stores s on s.trn_code = v.trn;
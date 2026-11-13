-- Remove the retired payment option from existing store payment preferences.
update public.stores
set accepted_payments = array_remove(accepted_payments, 'TRIKE_COD')
where accepted_payments @> array['TRIKE_COD'];

notify pgrst, 'reload schema';

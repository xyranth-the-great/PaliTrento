-- Allow product units beyond the built-in dropdown options.
alter table products drop constraint if exists products_unit_check;

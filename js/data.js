import { supabase } from './supabase.js';
import { SEED_STORES, SEED_PRODUCTS } from './seed.js';
export const usingSeed = () => !supabase;

async function load(table, seed, order) {
  if (!supabase) return seed;
  const { data, error } = await supabase.from(table).select('*').order(order);
  if (error) { console.warn(`Supabase ${table}:`, error.message); return seed; }
  return data?.length ? data : seed;
}
export const getStores = async () =>
  (await load('stores', SEED_STORES, 'business_name')).filter(s =>
    s.verification_status === 'VERIFIED' || s.approval_status === 'APPROVED'
  );
export const getProducts = () => load('products', SEED_PRODUCTS, 'name');
export const hasAvailableQuantity = product => {
  if (product?.quantity == null) return true;
  const quantity = Number(product.quantity);
  return !Number.isFinite(quantity) || quantity > 0;
};
export async function getStore(trn) {
  return (await getStores()).find(s => s.trn_code === trn) || null;
}

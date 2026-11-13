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
  (await load('stores', SEED_STORES, 'business_name')).filter(s => s.verification_status === 'VERIFIED');
export const getProducts = () => load('products', SEED_PRODUCTS, 'name');
export async function getStore(trn) {
  return (await getStores()).find(s => s.trn_code === trn) || null;
}

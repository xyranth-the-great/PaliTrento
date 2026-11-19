import { supabase } from './supabase.js';
import { SEED_STORES, SEED_PRODUCTS } from './seed.js';
export const usingSeed = () => !supabase;

async function load(table, seed, order) {
  if (!supabase) return seed;
  const { data, error } = await supabase.from(table).select('*').order(order);
  if (error) { console.warn(`Supabase ${table}:`, error.message); return []; }
  return data || [];
}
export const getStores = async () =>
  (await load('stores', SEED_STORES, 'business_name')).filter(s =>
    (s.verification_status === 'VERIFIED' || s.approval_status === 'APPROVED')
      && !s.marketplace_removed_at
  );
export const getProducts = async () => {
  const [products, stores] = await Promise.all([
    load('products', SEED_PRODUCTS, 'name'),
    getStores()
  ]);
  const visibleStoreIds = new Set(stores.map(store => store.id));
  return products.filter(product =>
    !product.marketplace_removed_at && visibleStoreIds.has(product.store_id)
  );
};
export const hasAvailableQuantity = product => {
  if (product?.quantity == null) return true;
  const quantity = Number(product.quantity);
  return !Number.isFinite(quantity) || quantity > 0;
};
export async function getStore(trn) {
  return (await getStores()).find(s => s.trn_code === trn) || null;
}

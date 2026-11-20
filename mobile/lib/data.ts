import { supabase } from './supabase';

export interface Store {
  id: string;
  user_id?: string | null;
  trn_code: string;
  business_name: string;
  proprietor_name?: string | null;
  trade_category: string;
  barangay: string;
  purok?: string | null;
  landmark_reference?: string | null;
  description?: string | null;
  contact_number?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  lat?: number | null;
  lng?: number | null;
  storefront_image_url?: string | null;
  accepted_payments?: string[] | null;
  verification_status?: string | null;
  approval_status?: string | null;
  certificate_status?: string | null;
  dti_registered?: boolean | null;
  bmbe_registered?: boolean | null;
  srp_compliant?: boolean | null;
  marketplace_removed_at?: string | null;
  is_premium?: boolean | null;
  has_featured_promo?: boolean | null;
  barangay_clearance_image_url?: string | null;
  cedula_image_url?: string | null;
  business_permit_image_url?: string | null;
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  category: string;
  unit: string;
  current_price: number;
  lgu_srp_ceiling?: number | null;
  in_stock?: boolean | null;
  quantity?: number | null;
  description?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  marketplace_removed_at?: string | null;
  is_premium_store?: boolean | null;
}

export interface OrderRecord {
  id: string;
  buyer_id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  payment_method?: string | null;
  notes?: string | null;
  status: string;
  ready_at?: string | null;
  cancellation_reason?: string | null;
  cancellation_actor?: string | null;
  created_at: string;
  products?: { name: string; unit: string; current_price: number } | null;
  stores?: { business_name: string; trn_code: string; barangay: string; user_id?: string } | null;
}

export interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
}

export interface UserProfile {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  barangay?: string | null;
  avatar_url?: string | null;
  account_status?: string | null;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  banned_at?: string | null;
  ban_reason?: string | null;
}

export function isStorePubliclyVisible(s: Store): boolean {
  return (
    (s.verification_status === 'VERIFIED' || s.approval_status === 'APPROVED') &&
    !s.marketplace_removed_at
  );
}

export function hasAvailableQuantity(p: Product): boolean {
  if (p.quantity == null) return true;
  const q = Number(p.quantity);
  return !Number.isFinite(q) || q > 0;
}

export function getProductImages(p: Product): string[] {
  if (Array.isArray(p.image_urls) && p.image_urls.length > 0) {
    return p.image_urls.filter(Boolean);
  }
  return p.image_url ? [p.image_url] : [];
}

export function formatPurok(purok?: string | null): string | null {
  if (!purok) return null;
  const trimmed = String(purok).trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? `Purok ${trimmed}` : trimmed;
}

export async function getPremiumStoreIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const { data, error } = await supabase.rpc('get_premium_stores');
    if (!error && Array.isArray(data)) {
      data.forEach((row: { id?: string }) => {
        if (row?.id) ids.add(row.id);
      });
    }
  } catch {
    // Graceful fallback — cards render normally without premium badge
  }
  return ids;
}

export async function getStores(): Promise<Store[]> {
  const { data, error } = await supabase.from('stores').select('*').order('business_name');
  if (error) {
    console.warn('getStores error:', error.message);
    return [];
  }
  return ((data || []) as Store[]).filter(isStorePubliclyVisible);
}

export async function getFeaturedStores(): Promise<Store[]> {
  try {
    const { data, error } = await supabase.rpc('get_public_featured_stores', { p_limit: 20 });
    if (error || !Array.isArray(data)) return [];
    return data as Store[];
  } catch {
    return [];
  }
}

export async function getProducts(existingStores?: Store[]): Promise<Product[]> {
  const [prodRes, stores, lockRes] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    existingStores ? Promise.resolve(existingStores) : getStores(),
    supabase.from('product_lock_states').select('product_id').eq('is_locked', true),
  ]);
  if (prodRes.error) {
    console.warn('getProducts error:', prodRes.error.message);
    return [];
  }
  const visibleStoreIds = new Set(stores.map((s) => s.id));
  const lockedIds = new Set((lockRes.data || []).map((r: { product_id: string }) => r.product_id));
  return ((prodRes.data || []) as Product[]).filter(
    (p) => !p.marketplace_removed_at && visibleStoreIds.has(p.store_id) && !lockedIds.has(p.id)
  );
}

export async function getStoreByTrn(trn: string): Promise<Store | null> {
  const [{ data, error }, premiumIds] = await Promise.all([
    supabase.from('stores').select('*').eq('trn_code', trn).maybeSingle(),
    getPremiumStoreIds(),
  ]);
  if (error || !data || data.marketplace_removed_at) return null;
  const store = data as Store;
  return { ...store, is_premium: Boolean(store.is_premium || premiumIds.has(store.id)) };
}

/**
 * Fetch a product + its store. Mirrors website product-detail.js:
 * - Blocks removed products / removed or unverified stores (unless viewer is the owner)
 * - Blocks locked products in `product_lock_states` for non-owners
 * - Resolves store premium status via `get_premium_stores`
 */
export async function getProductById(
  id: string,
  viewerUserId?: string | null
): Promise<{ product: Product; store: Store } | null> {
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !product || product.marketplace_removed_at) return null;

  const { data: storeRow, error: sErr } = await supabase
    .from('stores')
    .select('*')
    .eq('id', product.store_id)
    .maybeSingle();
  if (sErr || !storeRow || storeRow.marketplace_removed_at) return null;

  const isOwner = Boolean(viewerUserId && storeRow.user_id && viewerUserId === storeRow.user_id);
  if (!isOwner && !isStorePubliclyVisible(storeRow as Store)) {
    return null;
  }

  // Enforce product_lock_states check for non-owners
  if (!isOwner) {
    const { data: lock } = await supabase
      .from('product_lock_states')
      .select('is_locked')
      .eq('product_id', id)
      .eq('is_locked', true)
      .maybeSingle();
    if (lock?.is_locked) return null;
  }

  const premiumIds = await getPremiumStoreIds();
  const store: Store = {
    ...(storeRow as Store),
    is_premium: Boolean((storeRow as Store).is_premium || premiumIds.has(storeRow.id)),
  };

  return { product: product as Product, store };
}

/**
 * Fetch up to 4 related products in the same category ("You may also like").
 * Mirrors website product-detail.js `renderRelatedProducts`.
 */
export async function getRelatedProducts(
  currentProduct: Product,
  currentStoreIsPremium: boolean
): Promise<{ products: Product[]; storeMap: Record<string, Store> }> {
  try {
    const [stores, premiumIds] = await Promise.all([getStores(), getPremiumStoreIds()]);
    if (currentStoreIsPremium) premiumIds.add(currentProduct.store_id);

    const enrichedStores = stores.map((s) => ({
      ...s,
      is_premium: Boolean(s.is_premium || premiumIds.has(s.id)),
    }));
    const storeMap: Record<string, Store> = {};
    enrichedStores.forEach((s) => {
      storeMap[s.id] = s;
    });

    const allProducts = await getProducts(enrichedStores);
    const related = allProducts
      .filter(
        (p) =>
          p.id !== currentProduct.id &&
          p.category === currentProduct.category &&
          Boolean(p.in_stock) &&
          hasAvailableQuantity(p) &&
          Boolean(storeMap[p.store_id])
      )
      .sort((a, b) => Number(Boolean(storeMap[b.store_id]?.is_premium)) - Number(Boolean(storeMap[a.store_id]?.is_premium)))
      .slice(0, 4);

    return { products: related, storeMap };
  } catch {
    return { products: [], storeMap: {} };
  }
}

// ---------------------------------------------------------------------------
// Priority Search (mirrors website explore.js & products.js)
// ---------------------------------------------------------------------------
export async function searchStoresWithPriority(params: {
  query?: string;
  category?: string;
  barangay?: string;
  openOnly?: boolean;
  verifiedOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Store[] | null> {
  try {
    const { data, error } = await supabase.rpc('search_stores_with_priority', {
      p_query: params.query?.trim() || '',
      p_category: params.category || '',
      p_barangay: params.barangay || '',
      p_open_only: Boolean(params.openOnly),
      p_verified_only: Boolean(params.verifiedOnly),
      p_limit: params.limit ?? 100,
      p_offset: params.offset ?? 0,
    });
    if (error || !Array.isArray(data)) return null;
    return data as Store[];
  } catch {
    return null;
  }
}

export async function searchProductsWithPriority(params: {
  query?: string;
  category?: string;
  cappedOnly?: boolean;
  inStockOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Product[] | null> {
  try {
    const { data, error } = await supabase.rpc('search_products_with_priority', {
      p_query: params.query?.trim() || '',
      p_category: params.category || '',
      p_capped_only: Boolean(params.cappedOnly),
      p_in_stock_only: Boolean(params.inStockOnly),
      p_limit: params.limit ?? 100,
      p_offset: params.offset ?? 0,
    });
    if (error || !Array.isArray(data)) return null;
    return (data as Product[]).filter(hasAvailableQuantity);
  } catch {
    return null;
  }
}

// Client-side fuzzy + synonym product matching (ported from website products.js)
const SEARCH_SYNONYMS: Record<string, string[]> = {
  clothes: ['clothing', 'apparel', 'garment', 'garments'],
  clothing: ['clothes', 'apparel', 'garment', 'garments'],
  apparel: ['clothes', 'clothing', 'garment', 'garments'],
  garment: ['clothes', 'clothing', 'apparel', 'garments'],
  garments: ['clothes', 'clothing', 'apparel', 'garment'],
};

function normalizeSearchText(value?: string | null): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function closeSearchTokenMatch(queryToken: string, productToken: string): boolean {
  if (
    productToken === queryToken ||
    productToken.startsWith(queryToken) ||
    queryToken.startsWith(productToken)
  ) {
    return true;
  }
  if (
    queryToken.length < 5 ||
    productToken.length < 5 ||
    Math.abs(queryToken.length - productToken.length) > 1
  ) {
    return false;
  }

  let qi = 0;
  let pi = 0;
  let edits = 0;
  while (qi < queryToken.length && pi < productToken.length) {
    if (queryToken[qi] === productToken[pi]) {
      qi++;
      pi++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (queryToken.length > productToken.length) qi++;
    else if (queryToken.length < productToken.length) pi++;
    else {
      qi++;
      pi++;
    }
  }
  return edits + (queryToken.length - qi) + (productToken.length - pi) <= 1;
}

export function getProductSearchScore(product: Product, query: string, storeName?: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  const name = normalizeSearchText(product.name);
  const category = normalizeSearchText(product.category);
  const store = normalizeSearchText(storeName);
  if (name.includes(normalizedQuery)) return 100;
  if (category.includes(normalizedQuery)) return 90;
  if (store && store.includes(normalizedQuery)) return 75;

  const nameTokens = name.split(' ').filter(Boolean);
  const categoryTokens = category.split(' ').filter(Boolean);
  const storeTokens = store ? store.split(' ').filter(Boolean) : [];
  let score = 0;
  for (const queryToken of normalizedQuery.split(' ').filter(Boolean)) {
    const synonyms = SEARCH_SYNONYMS[queryToken] || [];
    const terms = [queryToken, ...synonyms];
    const nameMatch = nameTokens.some((pt) => terms.some((t) => closeSearchTokenMatch(t, pt)));
    const catMatch = categoryTokens.some((pt) => terms.some((t) => closeSearchTokenMatch(t, pt)));
    const storeMatch = storeTokens.some((pt) => terms.some((t) => closeSearchTokenMatch(t, pt)));
    if (!nameMatch && !catMatch && !storeMatch) return 0;
    score += nameMatch ? 8 : catMatch ? 5 : 4;
  }
  return score;
}

export async function getMyOrders(userId: string): Promise<OrderRecord[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      products (name, unit, current_price),
      stores (business_name, trn_code, barangay, user_id)
    `)
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('getMyOrders error:', error.message);
    return [];
  }
  return (data || []) as OrderRecord[];
}

import { supabase } from './supabase';
import { Product, Store } from './data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SellerOrder {
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
  created_at: string;
  products?: { name: string; unit: string; current_price: number } | null;
  buyer_name?: string | null;
}

export interface StoreDisplayStatus {
  status?: string;
  badge_class?: string;
  label?: string;
  message?: string;
  approval_notice_acknowledged?: boolean;
  verified_at?: string | null;
  [key: string]: unknown;
}

export interface BusinessCompliance {
  id?: string;
  store_id?: string;
  all_documents_approved?: boolean;
  approval_notice_acknowledged?: boolean;
  [key: string]: unknown;
}

export interface LockedProductRecord {
  id: string;
  product_id: string;
  user_id: string;
  is_locked: boolean;
  lock_reason: string;
  locked_at: string;
  products?: {
    id: string;
    name: string;
    image_url?: string | null;
    image_urls?: string[] | null;
    current_price: number;
  } | null;
}

export interface AccountWarning {
  id: string;
  reason: string;
  created_at: string;
}

export interface SellerAnalytics {
  completedRevenue: number;
  pipelineRevenue: number;
  avgOrderValue: number;
  completionRate: number;
  totalOrders: number;
  statusCounts: Record<string, number>;
  paymentCounts: { CASH: number; GCASH: number };
  inStockCount: number;
  outOfStockCount: number;
  cappedCount: number;
  overCapCount: number;
  topProducts: { id: string; name: string; unitsSold: number; revenue: number }[];
  dailySeries: { label: string; orders: number; revenue: number }[];
}

export interface SellerStats {
  productCount: number;
  orderCount: number;
  revenue: number;
  pendingCount: number;
}

export const FREE_LISTING_QUOTA = 15;

export const PERMITS = [
  {
    type: 'BARANGAY_CLEARANCE',
    uploadFolder: 'barangay-clearance',
    column: 'barangay_clearance_image_url',
    statusColumn: 'barangay_clearance_status',
    noteColumn: 'barangay_clearance_review_note',
    label: 'Barangay Business Clearance',
  },
  {
    type: 'CEDULA',
    uploadFolder: 'cedula',
    column: 'cedula_image_url',
    statusColumn: 'cedula_status',
    noteColumn: 'cedula_review_note',
    label: 'Community Tax Certificate (Cedula)',
  },
  {
    type: 'BUSINESS_PERMIT',
    uploadFolder: 'business-permit',
    column: 'business_permit_image_url',
    statusColumn: 'business_permit_status',
    noteColumn: 'business_permit_review_note',
    label: 'Business Permit',
  },
] as const;

export function canManageProducts(store?: Store | null): boolean {
  return store?.approval_status === 'APPROVED' || store?.verification_status === 'VERIFIED';
}

/** Same rule the website uses for the seller-facing status pill. */
export function storeStatusInfo(store: Store & Record<string, any>): {
  label: string;
  tone: 'ok' | 'warn' | 'bad' | 'info';
  message: string;
} {
  if (store.is_suspended) {
    return { label: 'Suspended', tone: 'bad', message: store.suspension_reason || 'Your store is suspended. Contact support.' };
  }
  if (store.approval_status === 'REJECTED') {
    return { label: 'Rejected', tone: 'bad', message: store.admin_notes || 'Your submission was rejected. Update your store and resubmit.' };
  }
  if (canManageProducts(store)) {
    return { label: 'Verified', tone: 'ok', message: 'Your store is live on PaliTrento.' };
  }
  if (store.admin_notes) {
    return { label: 'Needs changes', tone: 'warn', message: store.admin_notes };
  }
  return { label: 'Pending review', tone: 'info', message: 'Admin is reviewing your store. This usually takes 3–5 business days.' };
}

// ---------------------------------------------------------------------------
// Seller queries
// ---------------------------------------------------------------------------
export async function getMyStore(userId: string): Promise<(Store & Record<string, any>) | null> {
  const { data, error } = await supabase.from('stores').select('*').eq('user_id', userId).maybeSingle();
  if (error) {
    console.warn('getMyStore error:', error.message);
    return null;
  }
  return data;
}

export async function getStoreProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('getStoreProducts error:', error.message);
    return [];
  }
  return (data || []) as Product[];
}

export async function getStoreOrders(storeId: string): Promise<SellerOrder[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, products (name, unit, current_price)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('getStoreOrders error:', error.message);
    return [];
  }

  const buyerIds = [...new Set((orders || []).map((o: any) => o.buyer_id).filter(Boolean))];
  let names: Record<string, string> = {};
  if (buyerIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', buyerIds);
    names = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name]));
  }
  return (orders || []).map((o: any) => ({ ...o, buyer_name: names[o.buyer_id] || null }));
}

export function computeStats(products: Product[], orders: SellerOrder[]): SellerStats {
  return {
    productCount: products.length,
    orderCount: orders.length,
    revenue: orders
      .filter((o) => o.status === 'COMPLETED')
      .reduce((sum, o) => sum + Number(o.total_price || 0), 0),
    pendingCount: orders.filter((o) => o.status === 'PENDING').length,
  };
}

export async function getSubscriptionData(userId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase.rpc('get_subscription_dashboard_data', { p_user_id: userId });
    if (error) throw error;
    return data ?? null;
  } catch (e) {
    console.warn('getSubscriptionData error:', e);
    return null;
  }
}

export function isPremiumActive(sub: any): boolean {
  return sub?.subscription?.is_premium === true && sub?.subscription?.status === 'ACTIVE';
}

export function freeListingsUsed(sub: any, productCount: number): number {
  const reported = Number(sub?.entitlement?.free_listings_used);
  const reportedUsage = Number.isFinite(reported) ? Math.max(0, Math.floor(reported)) : 0;
  return Math.max(reportedUsage, Math.min(productCount, FREE_LISTING_QUOTA));
}

export async function updateOrderStatus(orderId: string, newStatus: string, reason: string | null = null) {
  const { error } = await supabase.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_cancellation_reason: reason,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Batch 3: Verification, Subscription, Featured Promo, Locked Products, Analytics, Avatar
// ---------------------------------------------------------------------------
const LEGACY_PENDING_STATUSES = [
  'APPROVED_NO_CERTIFICATE',
  'COMPLIANCE_EXPIRED',
  'CERTIFICATE_UNDER_REVIEW',
  'CERTIFICATE_REJECTED',
  'CERTIFICATE_REJECTED_EXPIRED',
];

export function normalizeDisplayStatus(status: StoreDisplayStatus | null): StoreDisplayStatus | null {
  if (!status) return null;
  if (status.status && LEGACY_PENDING_STATUSES.includes(status.status)) {
    return {
      status: 'PENDING_APPROVAL',
      badge_class: 'warn',
      label: 'Pending Approval',
      message: 'Your store and required permits are awaiting Admin review.',
    };
  }
  return status;
}

export async function getStoreDisplayStatus(storeId: string): Promise<StoreDisplayStatus | null> {
  try {
    const { data, error } = await supabase.rpc('get_store_display_status', { p_store_id: storeId });
    if (error || !data) return null;
    return normalizeDisplayStatus(data as StoreDisplayStatus);
  } catch {
    return null;
  }
}

export async function getBusinessCompliance(storeId: string): Promise<BusinessCompliance | null> {
  try {
    const { data, error } = await supabase
      .from('business_compliance')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();
    if (error) return null;
    return (data as BusinessCompliance) || null;
  } catch {
    return null;
  }
}

export async function acknowledgeBusinessApproval(storeId: string): Promise<void> {
  const { error } = await supabase.rpc('acknowledge_business_approval', { p_store_id: storeId });
  if (error) throw new Error(error.message);
}

export async function activatePremiumSubscription(
  userId: string,
  paymentReference = `demo-premium-${Date.now()}`
): Promise<any> {
  const { data, error } = await supabase.rpc('verify_payment_and_activate_subscription', {
    p_user_id: userId,
    p_plan_code: 'PREMIUM',
    p_payment_reference: paymentReference,
    p_period_days: 30,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Failed to activate Premium subscription');
  return data;
}

export async function createFeaturedStorePromo(
  userId: string,
  storeId: string,
  paymentReference = `demo-featured-${Date.now()}`
): Promise<any> {
  const { data, error } = await supabase.rpc('verify_payment_and_create_featured_promo', {
    p_user_id: userId,
    p_store_id: storeId,
    p_payment_reference: paymentReference,
    p_duration_days: 7,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Failed to create Featured Store promotion');
  return data;
}

export async function getLockedProducts(userId: string): Promise<LockedProductRecord[]> {
  try {
    const { data, error } = await supabase
      .from('product_lock_states')
      .select('*, products (id, name, image_url, image_urls, current_price)')
      .eq('user_id', userId)
      .eq('is_locked', true)
      .order('locked_at', { ascending: false });
    if (error || !data) return [];
    return data as unknown as LockedProductRecord[];
  } catch {
    return [];
  }
}

export async function unlockLockedProducts(
  userId: string,
  productIds: string[],
  paymentReference = `demo-bulk-${Date.now()}`
): Promise<any> {
  const { data, error } = await supabase.rpc('verify_payment_and_unlock_products', {
    p_user_id: userId,
    p_product_ids: productIds,
    p_payment_reference: paymentReference,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Failed to unlock selected products');
  return data;
}

export async function getAccountWarnings(userId: string): Promise<AccountWarning[]> {
  try {
    const { data, error } = await supabase
      .from('account_moderation_actions')
      .select('id, reason, created_at')
      .eq('target_user_id', userId)
      .eq('action', 'warn')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as AccountWarning[];
  } catch {
    return [];
  }
}

export function computeDetailedAnalytics(
  products: Product[],
  orders: SellerOrder[]
): SellerAnalytics {
  const statusCounts: Record<string, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    READY_FOR_PICKUP: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    EXPIRED: 0,
  };
  const paymentCounts = { CASH: 0, GCASH: 0 };
  let completedRevenue = 0;
  let pipelineRevenue = 0;

  const productPerf = new Map<string, { id: string; name: string; unitsSold: number; revenue: number }>();

  // Prepare last 7 days buckets (oldest -> today)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dailyMap = new Map<string, { label: string; orders: number; revenue: number }>();
  const dailyOrderKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400 * 1000);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    dailyOrderKeys.push(key);
    dailyMap.set(key, { label: dayNames[d.getDay()], orders: 0, revenue: 0 });
  }

  for (const o of orders) {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    const price = Number(o.total_price || 0);
    if (o.payment_method === 'GCASH') paymentCounts.GCASH += 1;
    else paymentCounts.CASH += 1;

    if (o.status === 'COMPLETED') {
      completedRevenue += price;
      const pid = o.product_id || o.products?.name || 'unknown';
      const entry = productPerf.get(pid) || {
        id: pid,
        name: o.products?.name || 'Product',
        unitsSold: 0,
        revenue: 0,
      };
      entry.unitsSold += Number(o.quantity || 0);
      entry.revenue += price;
      productPerf.set(pid, entry);
    } else if (['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP'].includes(o.status)) {
      pipelineRevenue += price;
    }

    const created = new Date(o.created_at);
    const dayKey = `${created.getFullYear()}-${created.getMonth()}-${created.getDate()}`;
    const bucket = dailyMap.get(dayKey);
    if (bucket) {
      bucket.orders += 1;
      if (o.status === 'COMPLETED') bucket.revenue += price;
    }
  }

  const completedCount = statusCounts.COMPLETED || 0;
  const finishedCount = completedCount + (statusCounts.CANCELLED || 0) + (statusCounts.EXPIRED || 0);
  const completionRate = finishedCount > 0 ? Math.round((completedCount / finishedCount) * 100) : 0;
  const avgOrderValue = completedCount > 0 ? completedRevenue / completedCount : 0;

  let inStockCount = 0;
  let outOfStockCount = 0;
  let cappedCount = 0;
  let overCapCount = 0;
  for (const p of products) {
    const out = p.in_stock === false || (p.quantity != null && Number(p.quantity) <= 0);
    if (out) outOfStockCount += 1;
    else inStockCount += 1;
    if (p.lgu_srp_ceiling != null) {
      cappedCount += 1;
      if (Number(p.current_price) > Number(p.lgu_srp_ceiling)) overCapCount += 1;
    }
  }

  const topProducts = [...productPerf.values()]
    .sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold)
    .slice(0, 5);

  const dailySeries = dailyOrderKeys.map((k) => dailyMap.get(k)!);

  return {
    completedRevenue,
    pipelineRevenue,
    avgOrderValue,
    completionRate,
    totalOrders: orders.length,
    statusCounts,
    paymentCounts,
    inStockCount,
    outOfStockCount,
    cappedCount,
    overCapCount,
    topProducts,
    dailySeries,
  };
}

// ---------------------------------------------------------------------------
// Avatar upload (`avatars` bucket — exact parity with website auth.js & account.js)
// ---------------------------------------------------------------------------
const AVATARS_BUCKET = 'avatars';

export async function uploadUserAvatar(
  userId: string,
  uri: string,
  previousAvatarUrl?: string | null
): Promise<string> {
  const small = await compressToWebp(uri, 256);
  const path = `${userId}/avatar-${Date.now()}.webp`;
  const publicUrl = await uploadFile(AVATARS_BUCKET, path, small.uri, 'image/webp');

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);
  if (error) throw new Error(error.message);

  if (previousAvatarUrl && previousAvatarUrl !== publicUrl) {
    await deleteAvatarObject(previousAvatarUrl);
  }
  return publicUrl;
}

export async function removeUserAvatar(
  userId: string,
  previousAvatarUrl?: string | null
): Promise<void> {
  if (previousAvatarUrl) {
    await deleteAvatarObject(previousAvatarUrl);
  }
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

async function deleteAvatarObject(avatarUrl: string): Promise<void> {
  try {
    const match = avatarUrl.match(/\/avatars\/(.+)$/);
    if (!match) return;
    await supabase.storage.from(AVATARS_BUCKET).remove([decodeURIComponent(match[1])]);
  } catch {
    // non-fatal cleanup
  }
}

// ---------------------------------------------------------------------------
// Image upload (mirrors the website's storage.js paths and buckets)
// ---------------------------------------------------------------------------
const PRODUCT_BUCKET = 'product-images';
const STORE_BUCKET = 'store-images';

function randomId(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len).padEnd(len, '0');
}

async function compressToWebp(uri: string, maxSize: number): Promise<{ uri: string }> {
  const ImageManipulator = await import('expo-image-manipulator');
  const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
  ctx.resize({ width: maxSize });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.85,
    format: ImageManipulator.SaveFormat.WEBP,
  });
  return { uri: saved.uri };
}

async function uploadFile(bucket: string, path: string, uri: string, contentType: string): Promise<string> {
  const res = await fetch(uri);
  const body = await res.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function uploadProductImages(userId: string, productId: string, uris: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const uri of uris.slice(0, 3)) {
    const small = await compressToWebp(uri, 800);
    const path = `${userId}/products/${productId}/${Date.now()}-${randomId()}.webp`;
    urls.push(await uploadFile(PRODUCT_BUCKET, path, small.uri, 'image/webp'));
  }
  return urls;
}

export async function deleteProductImages(urls: string[]) {
  const paths = urls
    .map((u) => {
      const m = u.match(/\/product-images\/(.+)$/);
      return m ? decodeURIComponent(m[1]) : null;
    })
    .filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from(PRODUCT_BUCKET).remove(paths);
}

export async function uploadStoreImage(userId: string, uri: string, folder: string): Promise<string> {
  const small = await compressToWebp(uri, 1400);
  const path = `${userId}/${folder}/${Date.now()}.webp`;
  return uploadFile(STORE_BUCKET, path, small.uri, 'image/webp');
}

// ---------------------------------------------------------------------------
// Product save (create / update) — same flow as dashboard.js
// ---------------------------------------------------------------------------
export interface ProductInput {
  name: string;
  category: string;
  unit: string;
  current_price: number;
  in_stock: boolean;
  quantity: number | null;
  lgu_srp_ceiling?: number | null;
}

export async function createProduct(
  userId: string,
  storeId: string,
  input: ProductInput,
  imageUris: string[],
  isPaidListing: boolean
) {
  const { data: created, error } = await supabase
    .from('products')
    .insert({ ...input, store_id: storeId, is_paid_listing: isPaidListing })
    .select('id')
    .single();
  if (error) throw error;

  try {
    const urls = await uploadProductImages(userId, created.id, imageUris);
    const { error: imgErr } = await supabase
      .from('products')
      .update({ image_urls: urls, image_url: urls[0] || null })
      .eq('id', created.id)
      .eq('store_id', storeId);
    if (imgErr) {
      await deleteProductImages(urls);
      throw imgErr;
    }
  } catch (e) {
    await supabase.from('products').delete().eq('id', created.id).eq('store_id', storeId);
    throw e;
  }

  try {
    await supabase.rpc('record_product_listing', { p_user_id: userId, p_is_paid: isPaidListing });
  } catch (e) {
    console.warn('record_product_listing failed:', e);
  }
}

export async function updateProduct(
  userId: string,
  storeId: string,
  product: Product,
  input: ProductInput,
  keptUrls: string[],
  newUris: string[]
) {
  const original =
    Array.isArray(product.image_urls) && product.image_urls.length
      ? product.image_urls
      : product.image_url
        ? [product.image_url]
        : [];
  let urls = [...keptUrls];
  if (newUris.length) {
    const uploaded = await uploadProductImages(userId, product.id, newUris);
    urls = [...keptUrls, ...uploaded].slice(0, 3);
  }
  const { error } = await supabase
    .from('products')
    .update({ ...input, image_urls: urls, image_url: urls[0] || null })
    .eq('id', product.id)
    .eq('store_id', storeId);
  if (error) throw error;
  const removed = original.filter((u) => !urls.includes(u));
  if (removed.length) await deleteProductImages(removed);
}

export async function deleteProduct(product: Product) {
  const { error } = await supabase.from('products').delete().eq('id', product.id);
  if (error) throw error;
  const urls =
    Array.isArray(product.image_urls) && product.image_urls.length
      ? product.image_urls
      : product.image_url
        ? [product.image_url]
        : [];
  if (urls.length) await deleteProductImages(urls);
}

// ---------------------------------------------------------------------------
// Store setup
// ---------------------------------------------------------------------------
export function createTrnCode() {
  const suffix = (randomId(6) + randomId(6)).toUpperCase().slice(0, 12);
  return `TRN-${new Date().getFullYear()}-${suffix}`;
}

export async function saveStore(
  userId: string,
  existing: (Store & Record<string, any>) | null,
  data: Record<string, any>
) {
  const isApprovedUpdate = !!existing && canManageProducts(existing);
  const payload: Record<string, any> = {
    ...data,
    trn_code: existing?.trn_code || createTrnCode(),
    user_id: userId,
    verification_status: isApprovedUpdate ? 'VERIFIED' : 'PENDING',
    srp_compliant: isApprovedUpdate ? existing!.srp_compliant : false,
    dti_registered: isApprovedUpdate ? existing!.dti_registered : false,
    bmbe_registered: isApprovedUpdate ? existing!.bmbe_registered : false,
  };

  if (existing) {
    const { error } = await supabase.from('stores').update(payload).eq('id', existing.id);
    if (error) throw error;
    return { isApprovedUpdate };
  }

  let lastError: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from('stores').insert(payload);
    if (!error) return { isApprovedUpdate: false };
    lastError = error;
    if (error.code !== '23505') break;
    payload.trn_code = createTrnCode();
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export function adminStatus(s: Record<string, any>): { label: string; tone: 'ok' | 'warn' | 'bad' } {
  if (s.is_suspended) return { label: 'Suspended', tone: 'bad' };
  if (s.approval_status === 'REJECTED') return { label: 'Rejected', tone: 'bad' };
  if (s.approval_status === 'APPROVED') return { label: 'Approved', tone: 'ok' };
  return { label: 'Pending', tone: 'warn' };
}
export async function adminGetStores(): Promise<(Store & Record<string, any>)[]> {
  const { data, error } = await supabase.from('stores').select('*').order('created_at', { ascending: false });
  if (error) {
    console.warn('adminGetStores error:', error.message);
    return [];
  }
  return data || [];
}

export async function adminReviewPermit(
  storeId: string,
  permitType: string,
  action: 'APPROVE' | 'REJECT',
  note: string | null
) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.rpc('admin_review_store_permit', {
    p_actor_id: u.user?.id,
    p_store_id: storeId,
    p_permit_type: permitType,
    p_action: action,
    p_review_note: note,
  });
  if (error) throw error;
}

export async function adminApproveStore(storeId: string, notes: string | null) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.rpc('admin_approve_store_submission', {
    p_actor_id: u.user?.id,
    p_store_id: storeId,
    p_admin_notes: notes,
  });
  if (error) throw error;
}

export async function adminSetStoreStatus(storeId: string, approvalStatus: 'PENDING' | 'REJECTED', notes: string) {
  const { error } = await supabase
    .from('stores')
    .update({ approval_status: approvalStatus, admin_notes: notes, updated_at: new Date().toISOString() })
    .eq('id', storeId);
  if (error) throw error;
}

export interface AdvisoryInput {
  title: string;
  body: string;
  category: string;
  priority: string;
  barangay: string | null;
  expires_at: string | null;
}

export async function adminSendAdvisory(input: AdvisoryInput) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('advisories')
    .insert({ ...input, created_by: u.user?.id })
    .select('id')
    .single();
  if (error) throw error;
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: { advisoryId: data.id, title: input.title, body: input.body },
    });
  } catch (e) {
    console.warn('push send failed:', e);
  }
}

export async function adminGetAdvisories(limit = 20) {
  const { data } = await supabase
    .from('advisories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

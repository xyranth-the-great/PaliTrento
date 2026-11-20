import { supabase } from './supabase';
import type { Tone } from '../components/ui';

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------
export interface AdminDashboardCounts {
  openBusinessReports: number;
  openProductReports: number;
  openSupportTickets: number;
  pendingDocs: number;
  pickupCases: number;
  removedStores: number;
  removedProducts: number;
}

export interface AccountModerationActionRecord {
  id?: string;
  action: string;
  reason: string;
  actor_name?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface AdminAccount {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  account_status?: string | null;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  ban_reason?: string | null;
  auth_banned?: boolean;
  is_premium?: boolean;
  premium_ends_at?: string | null;
  recent_actions?: AccountModerationActionRecord[];
}

export type ModerationActionType =
  | 'warn'
  | 'suspend_temporary'
  | 'suspend_permanent'
  | 'ban'
  | 'restore'
  | 'unban'
  | 'remove_premium';

export const MODERATION_DURATION_OPTIONS = [
  { hours: 24, label: '1 Day' },
  { hours: 72, label: '3 Days' },
  { hours: 168, label: '7 Days' },
  { hours: 336, label: '14 Days' },
  { hours: 720, label: '30 Days' },
] as const;

export const MODERATION_ACTION_LABELS: Record<string, string> = {
  warn: 'Warning',
  suspend_temporary: 'Temporary suspension',
  suspend_permanent: 'Permanent suspension',
  ban: 'Permanent ban',
  restore: 'Restore access',
  unban: 'Remove ban',
  remove_premium: 'Remove Premium',
};

export const REPORT_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: 'Open', tone: 'info' },
  UNDER_REVIEW: { label: 'Under Review', tone: 'warn' },
  RESOLVED: { label: 'Resolved', tone: 'ok' },
  DISMISSED: { label: 'Dismissed', tone: 'muted' },
};

export const REPORT_REASON_LABELS: Record<string, string> = {
  INAPPROPRIATE_CONTENT: 'Inappropriate Content',
  MISLEADING_INFORMATION: 'Misleading Information',
  SUSPECTED_FRAUD: 'Suspected Fraud',
  FAKE_IDENTITY: 'Fake Identity',
  PROHIBITED_PRODUCTS: 'Prohibited Products',
  HARASSMENT: 'Harassment',
  OTHER: 'Other',
  INAPPROPRIATE_PRODUCT: 'Inappropriate Product',
  PROHIBITED_PRODUCT: 'Prohibited Product',
  MISLEADING_DESCRIPTION: 'Misleading Description',
  FRAUDULENT_LISTING: 'Fraudulent Listing',
  INCORRECT_PRICING: 'Incorrect Pricing',
  COPYRIGHT_CONCERN: 'Copyright Concern',
};

export const BUSINESS_REPORT_REASON_LIST = [
  'INAPPROPRIATE_CONTENT',
  'MISLEADING_INFORMATION',
  'SUSPECTED_FRAUD',
  'FAKE_IDENTITY',
  'PROHIBITED_PRODUCTS',
  'HARASSMENT',
  'OTHER',
] as const;

export const PRODUCT_REPORT_REASON_LIST = [
  'INAPPROPRIATE_PRODUCT',
  'PROHIBITED_PRODUCT',
  'MISLEADING_DESCRIPTION',
  'FRAUDULENT_LISTING',
  'INCORRECT_PRICING',
  'COPYRIGHT_CONCERN',
  'OTHER',
] as const;

export const DOC_TYPE_LABELS: Record<string, string> = {
  BARANGAY_CLEARANCE: 'Barangay Clearance',
  CEDULA: 'Cedula',
  BUSINESS_PERMIT: 'Business Permit',
};

export const DOC_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  PENDING_REVIEW: { label: 'Pending Review', tone: 'warn' },
  APPROVED: { label: 'Approved', tone: 'ok' },
  REJECTED: { label: 'Rejected', tone: 'bad' },
};

export interface AdminBusinessReport {
  id: string;
  reporter_id: string;
  store_id: string;
  reason: string;
  description?: string | null;
  status: string;
  admin_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  stores?: { business_name?: string | null; trn_code?: string | null; user_id?: string | null } | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
}

export interface AdminProductReport {
  id: string;
  reporter_id: string;
  product_id: string;
  store_id: string;
  reason: string;
  description?: string | null;
  status: string;
  admin_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  products?: { name?: string | null; store_id?: string | null } | null;
  stores?: { business_name?: string | null; trn_code?: string | null; user_id?: string | null } | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
}

export interface AdminSupportMessage {
  id: string;
  sender_id: string;
  content: string;
  is_from_admin: boolean;
  read_at?: string | null;
  created_at: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
  profiles?: { full_name?: string | null } | null;
}

export interface AdminSupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
  created_at: string;
  updated_at?: string | null;
  resolved_at?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  support_messages?: AdminSupportMessage[];
}

export interface AdminMarketplaceStore {
  id: string;
  user_id?: string | null;
  business_name: string;
  trade_category: string;
  barangay?: string | null;
  trn_code: string;
  marketplace_removed_at?: string | null;
  marketplace_removal_reason?: string | null;
}

export interface AdminMarketplaceProduct {
  id: string;
  store_id: string;
  name: string;
  category?: string | null;
  unit?: string | null;
  current_price: number;
  lgu_srp_ceiling?: number | null;
  marketplace_removed_at?: string | null;
  marketplace_removal_reason?: string | null;
}

export interface PickupNoShowCase {
  id: string;
  order_id: string;
  customer_id?: string | null;
  customer_name: string;
  store_id?: string | null;
  store_name: string;
  product_name: string;
  quantity: number;
  ready_at: string;
  expired_at: string;
  reason: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: number | string;
  actor_user_id?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  target_user_id?: string | null;
  target_name?: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  resource_type: string;
  resource_id?: string | null;
  summary?: string | null;
  changed_fields?: string[] | null;
  created_at: string;
}

export interface AdminBusinessDocument {
  id: string;
  store_id: string;
  user_id: string;
  document_type: string;
  file_path: string;
  file_name?: string | null;
  mime_type?: string | null;
  status: string;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  stores?: { id?: string; business_name?: string | null; trn_code?: string | null; user_id?: string | null } | null;
}

export interface AdminReportsOverview {
  totalStores: number;
  verifiedStores: number;
  pendingStores: number;
  suspendedStores: number;
  totalProducts: number;
  totalOrders: number;
  withinCap: number;
  overCap: number;
  noCap: number;
  categoryBreakdown: { category: string; count: number }[];
  barangayBreakdown: { barangay: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function formatAdminDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

export function accountIsSuspended(account: AdminAccount): boolean {
  return (
    account.account_status === 'suspended' &&
    (!account.suspended_until || new Date(account.suspended_until).getTime() > Date.now())
  );
}

export function accountIsBanned(account: AdminAccount): boolean {
  return account.account_status === 'banned';
}

export function getAccountStatus(account: AdminAccount): 'active' | 'suspended' | 'banned' {
  if (accountIsBanned(account)) return 'banned';
  if (accountIsSuspended(account)) return 'suspended';
  return 'active';
}

export function getAvailableModerationActions(
  account: AdminAccount,
  currentAdminId?: string | null
): { value: ModerationActionType; label: string; destructive?: boolean }[] {
  const status = getAccountStatus(account);
  const ownAdmin = account.id === currentAdminId && account.role === 'admin';
  if (ownAdmin) return [];

  const list: { value: ModerationActionType; label: string; destructive?: boolean }[] = [
    { value: 'warn', label: 'Issue warning' },
  ];

  if (account.is_premium) {
    list.push({ value: 'remove_premium', label: 'Remove Premium', destructive: true });
  }

  if (status === 'active') {
    list.push(
      { value: 'suspend_temporary', label: 'Temporary suspension', destructive: true },
      { value: 'suspend_permanent', label: 'Permanent suspension', destructive: true },
      { value: 'ban', label: 'Permanent ban', destructive: true }
    );
    if (account.auth_banned) {
      list.push({ value: 'restore', label: 'Clear sign-in restriction' });
    }
  } else if (status === 'suspended') {
    list.push({ value: 'restore', label: 'Restore access' });
  } else if (status === 'banned') {
    list.push({ value: 'unban', label: 'Remove ban' });
  }

  return list;
}

async function extractEdgeError(error: any, fallback: string): Promise<string> {
  const response = error?.context;
  if (response && typeof response.clone === 'function') {
    try {
      const payload = await response.clone().json();
      if (typeof payload?.error === 'string' && payload.error) return payload.error;
    } catch {
      // ignore json parse failure
    }
  }
  return error?.message || fallback;
}

// ---------------------------------------------------------------------------
// Dashboard Summary Counts
// ---------------------------------------------------------------------------
export async function adminGetDashboardCounts(): Promise<AdminDashboardCounts> {
  const safeCount = async (fn: () => PromiseLike<{ count: number | null; error: any }>): Promise<number> => {
    try {
      const { count, error } = await fn();
      return error ? 0 : count || 0;
    } catch {
      return 0;
    }
  };

  const [
    openBusinessReports,
    openProductReports,
    openSupportTickets,
    pendingDocs,
    pickupCases,
    removedStores,
    removedProducts,
  ] = await Promise.all([
    safeCount(() =>
      supabase
        .from('business_reports')
        .select('id', { count: 'exact', head: true })
        .in('status', ['OPEN', 'UNDER_REVIEW'])
    ),
    safeCount(() =>
      supabase
        .from('product_reports')
        .select('id', { count: 'exact', head: true })
        .in('status', ['OPEN', 'UNDER_REVIEW'])
    ),
    safeCount(() =>
      supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER'])
    ),
    safeCount(() =>
      supabase
        .from('business_documents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING_REVIEW')
    ),
    safeCount(() =>
      supabase.from('pickup_no_show_cases').select('id', { count: 'exact', head: true })
    ),
    safeCount(() =>
      supabase
        .from('stores')
        .select('id', { count: 'exact', head: true })
        .not('marketplace_removed_at', 'is', null)
    ),
    safeCount(() =>
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .not('marketplace_removed_at', 'is', null)
    ),
  ]);

  return {
    openBusinessReports,
    openProductReports,
    openSupportTickets,
    pendingDocs,
    pickupCases,
    removedStores,
    removedProducts,
  };
}

// ---------------------------------------------------------------------------
// Restore Suspended Store (parity with admin-verification.js)
// ---------------------------------------------------------------------------
export async function adminRestoreSuspendedStore(store: Record<string, any>): Promise<void> {
  const hasAllPermits = [
    store.barangay_clearance_image_url,
    store.cedula_image_url,
    store.business_permit_image_url,
  ].every((url) => typeof url === 'string' && url.trim().length > 0);

  const canRestoreAsVerified = store.certificate_status === 'APPROVED' && hasAllPermits;

  const { error } = await supabase
    .from('stores')
    .update({
      approval_status: canRestoreAsVerified ? 'APPROVED' : 'PENDING',
      verification_status: canRestoreAsVerified ? 'VERIFIED' : 'PENDING',
      is_suspended: false,
      suspension_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', store.id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Accounts Moderation (parity with admin-accounts.js)
// ---------------------------------------------------------------------------
export async function adminListAccounts(): Promise<AdminAccount[]> {
  const { data, error } = await supabase.functions.invoke('admin-account-moderation', {
    body: { action: 'list' },
  });
  if (error || data?.error) {
    throw new Error(
      data?.error ||
        (await extractEdgeError(
          error,
          'Could not load accounts. Ensure you are signed in as an administrator.'
        ))
    );
  }
  return (data?.accounts || []) as AdminAccount[];
}

export async function adminSubmitModeration(params: {
  targetUserId: string;
  moderationAction: ModerationActionType;
  reason: string;
  durationHours?: number;
  customDurationDays?: number;
}): Promise<{ warning?: string }> {
  const body: Record<string, unknown> =
    params.moderationAction === 'remove_premium'
      ? {
          action: 'remove_premium',
          targetUserId: params.targetUserId,
          reason: params.reason.trim(),
        }
      : {
          action: 'moderate',
          targetUserId: params.targetUserId,
          moderationAction: params.moderationAction,
          reason: params.reason.trim(),
        };

  if (params.moderationAction === 'suspend_temporary') {
    if (params.customDurationDays != null) {
      body.customDurationDays = params.customDurationDays;
    } else if (params.durationHours != null) {
      body.durationHours = params.durationHours;
    }
  }

  const { data, error } = await supabase.functions.invoke('admin-account-moderation', { body });
  if (error || data?.error) {
    throw new Error(
      data?.error || (await extractEdgeError(error, 'Moderation action failed. Please try again.'))
    );
  }
  return { warning: data?.warning };
}

// ---------------------------------------------------------------------------
// Reports Management (parity with admin-reports-management.html)
// ---------------------------------------------------------------------------
export async function adminGetAllReports(): Promise<{
  businessReports: AdminBusinessReport[];
  productReports: AdminProductReport[];
}> {
  const [bRes, pRes] = await Promise.all([
    supabase
      .from('business_reports')
      .select(
        '*, stores(business_name, trn_code, user_id), profiles!business_reports_reporter_id_fkey(full_name, email)'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('product_reports')
      .select(
        '*, products(name, store_id), stores(business_name, trn_code, user_id), profiles!product_reports_reporter_id_fkey(full_name, email)'
      )
      .order('created_at', { ascending: false }),
  ]);

  if (bRes.error) throw new Error(bRes.error.message);
  if (pRes.error) throw new Error(pRes.error.message);

  return {
    businessReports: (bRes.data || []) as unknown as AdminBusinessReport[],
    productReports: (pRes.data || []) as unknown as AdminProductReport[],
  };
}

export async function adminUpdateReportStatus(params: {
  reportType: 'BUSINESS' | 'PRODUCT';
  reportId: string;
  status: 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED' | 'OPEN';
  adminNotes: string | null;
}): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.rpc('admin_update_report_status', {
    p_actor_id: u.user?.id,
    p_report_type: params.reportType,
    p_report_id: params.reportId,
    p_status: params.status,
    p_admin_notes: params.adminNotes?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Admin Support Inbox (parity with admin-support.html)
// ---------------------------------------------------------------------------
export async function adminGetSupportTickets(): Promise<AdminSupportTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select(
      '*, profiles!support_tickets_user_id_fkey(full_name, email), support_messages(id, is_from_admin, read_at)'
    )
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as unknown as AdminSupportTicket[];
}

export async function adminGetSupportTicketDetail(
  ticketId: string
): Promise<AdminSupportTicket | null> {
  let ticket: AdminSupportTicket | null = null;

  const { data, error } = await supabase
    .from('support_tickets')
    .select(
      '*, profiles!support_tickets_user_id_fkey(full_name, email), support_messages(id, sender_id, content, is_from_admin, read_at, created_at, attachment_path, attachment_name, profiles!support_messages_sender_id_fkey(full_name))'
    )
    .eq('id', ticketId)
    .maybeSingle();

  if (error) {
    // Fallback without nested sender join if PostgREST hint differs
    const fallback = await supabase
      .from('support_tickets')
      .select(
        '*, profiles!support_tickets_user_id_fkey(full_name, email), support_messages(id, sender_id, content, is_from_admin, read_at, created_at, attachment_path, attachment_name)'
      )
      .eq('id', ticketId)
      .maybeSingle();
    if (fallback.error || !fallback.data) throw new Error(fallback.error?.message || error.message);
    ticket = fallback.data as unknown as AdminSupportTicket;
  } else {
    ticket = (data as unknown as AdminSupportTicket) || null;
  }

  if (!ticket) return null;

  const sorted = [...(ticket.support_messages || [])].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
  );
  ticket.support_messages = sorted;

  // Mark unread user messages as read best-effort
  const unreadUserIds = sorted.filter((m) => !m.is_from_admin && !m.read_at).map((m) => m.id);
  if (unreadUserIds.length > 0) {
    await supabase
      .from('support_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadUserIds);
  }

  return ticket;
}

export async function adminReplySupportTicket(ticketId: string, content: string): Promise<void> {
  const { error } = await supabase.rpc('add_support_message', {
    p_ticket_id: ticketId,
    p_content: content.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function adminUpdateTicketStatus(
  ticketId: string,
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED'
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.rpc('admin_update_ticket_status', {
    p_actor_id: u.user?.id,
    p_ticket_id: ticketId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Marketplace Visibility & LGU Price Caps (parity with admin-marketplace.js)
// ---------------------------------------------------------------------------
export async function adminGetMarketplaceListings(): Promise<{
  stores: AdminMarketplaceStore[];
  products: AdminMarketplaceProduct[];
}> {
  const [storeRes, productRes] = await Promise.all([
    supabase
      .from('stores')
      .select(
        'id, user_id, business_name, trade_category, barangay, trn_code, marketplace_removed_at, marketplace_removal_reason'
      )
      .order('business_name'),
    supabase
      .from('products')
      .select(
        'id, store_id, name, category, unit, current_price, lgu_srp_ceiling, marketplace_removed_at, marketplace_removal_reason'
      )
      .order('name'),
  ]);

  if (storeRes.error) throw new Error(storeRes.error.message);
  if (productRes.error) throw new Error(productRes.error.message);

  return {
    stores: (storeRes.data || []) as AdminMarketplaceStore[],
    products: (productRes.data || []) as AdminMarketplaceProduct[],
  };
}

export async function adminSetMarketplaceVisibility(params: {
  kind: 'stores' | 'products';
  id: string;
  remove: boolean;
  reason?: string;
}): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const update = params.remove
    ? {
        marketplace_removed_at: new Date().toISOString(),
        marketplace_removed_by: u.user?.id || null,
        marketplace_removal_reason: (params.reason || '').trim(),
      }
    : {
        marketplace_removed_at: null,
        marketplace_removed_by: null,
        marketplace_removal_reason: null,
      };
  const { error } = await supabase.from(params.kind).update(update).eq('id', params.id);
  if (error) throw new Error(error.message);
}

export async function adminUpdateProductPriceCap(
  productId: string,
  newCap: number | null
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ lgu_srp_ceiling: newCap })
    .eq('id', productId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Pickup No-Show Cases (parity with admin-pickup-cases.js)
// ---------------------------------------------------------------------------
export async function adminGetPickupCases(): Promise<PickupNoShowCase[]> {
  const { data, error } = await supabase
    .from('pickup_no_show_cases')
    .select(
      'id, order_id, customer_id, customer_name, store_id, store_name, product_name, quantity, ready_at, expired_at, reason, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      throw new Error('Pickup no-show table is not installed on the backend yet.');
    }
    throw new Error(error.message);
  }
  return (data || []) as PickupNoShowCase[];
}

// ---------------------------------------------------------------------------
// Activity / Audit Log (parity with admin-activity.js)
// ---------------------------------------------------------------------------
export async function adminGetAuditLogs(actionFilter?: string): Promise<AuditLogEntry[]> {
  let query = supabase
    .from('audit_logs')
    .select(
      'id, actor_user_id, actor_name, actor_role, target_user_id, target_name, action, resource_type, resource_id, summary, changed_fields, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(250);
  if (actionFilter) {
    query = query.eq('action', actionFilter);
  }
  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      throw new Error('Audit logging table is not installed on the backend yet.');
    }
    throw new Error(error.message);
  }
  return (data || []) as AuditLogEntry[];
}

// ---------------------------------------------------------------------------
// Verification Documents (parity with admin-verification-docs.html)
// ---------------------------------------------------------------------------
export async function adminGetBusinessDocuments(filters?: {
  documentType?: string;
  status?: string;
}): Promise<AdminBusinessDocument[]> {
  let query = supabase
    .from('business_documents')
    .select('*, stores(id, business_name, trn_code, user_id)');
  if (filters?.documentType) query = query.eq('document_type', filters.documentType);
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query.order('submitted_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as unknown as AdminBusinessDocument[];
}

export async function adminGetBusinessDocumentUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('business-documents')
    .createSignedUrl(filePath, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Could not generate document link');
  }
  return data.signedUrl;
}

export async function adminReviewBusinessDocument(params: {
  documentId: string;
  action: 'APPROVE' | 'REJECT';
  rejectionReason?: string | null;
}): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.rpc('admin_review_business_document', {
    p_actor_id: u.user?.id,
    p_document_id: params.documentId,
    p_action: params.action,
    p_rejection_reason: params.rejectionReason?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Reports Overview (parity with admin-reports.js)
// ---------------------------------------------------------------------------
export async function adminGetReportsOverview(): Promise<AdminReportsOverview> {
  const [storesRes, productsRes, ordersCountRes] = await Promise.all([
    supabase
      .from('stores')
      .select('verification_status, approval_status, is_suspended, trade_category, barangay'),
    supabase.from('products').select('lgu_srp_ceiling, current_price'),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
  ]);

  if (storesRes.error) throw new Error(storesRes.error.message);

  const stores = storesRes.data || [];
  const products = productsRes.data || [];
  const totalOrders = ordersCountRes.error ? 0 : ordersCountRes.count || 0;

  let verifiedStores = 0;
  let pendingStores = 0;
  let suspendedStores = 0;
  const catCounts: Record<string, number> = {};
  const brgyCounts: Record<string, number> = {};

  for (const s of stores as any[]) {
    if (s.is_suspended) suspendedStores += 1;
    else if (s.verification_status === 'VERIFIED' || s.approval_status === 'APPROVED') {
      verifiedStores += 1;
    } else if (s.approval_status !== 'REJECTED') {
      pendingStores += 1;
    }
    const cat = s.trade_category || 'OTHER';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
    const brgy = s.barangay || 'Unspecified';
    brgyCounts[brgy] = (brgyCounts[brgy] || 0) + 1;
  }

  let withinCap = 0;
  let overCap = 0;
  let noCap = 0;
  for (const p of products as any[]) {
    if (p.lgu_srp_ceiling == null) noCap += 1;
    else if (Number(p.current_price) <= Number(p.lgu_srp_ceiling)) withinCap += 1;
    else overCap += 1;
  }

  const categoryBreakdown = Object.entries(catCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const barangayBreakdown = Object.entries(brgyCounts)
    .map(([barangay, count]) => ({ barangay, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalStores: stores.length,
    verifiedStores,
    pendingStores,
    suspendedStores,
    totalProducts: products.length,
    totalOrders,
    withinCap,
    overCap,
    noCap,
    categoryBreakdown,
    barangayBreakdown,
  };
}

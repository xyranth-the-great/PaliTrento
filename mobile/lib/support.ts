import { supabase } from './supabase';
import type { Tone } from '../components/ui';

// ---------------------------------------------------------------------------
// Report Business & Product (mirrors report-business.html & report-product.html)
// ---------------------------------------------------------------------------
export const BUSINESS_REPORT_REASONS = [
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate business content' },
  { value: 'MISLEADING_INFORMATION', label: 'Misleading business information' },
  { value: 'SUSPECTED_FRAUD', label: 'Suspected fraudulent business' },
  { value: 'FAKE_IDENTITY', label: 'Fake or misleading business identity' },
  { value: 'PROHIBITED_PRODUCTS', label: 'Prohibited or illegal products/services' },
  { value: 'HARASSMENT', label: 'Harassment or abusive behavior' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const PRODUCT_REPORT_REASONS = [
  { value: 'INAPPROPRIATE_PRODUCT', label: 'Inappropriate product' },
  { value: 'PROHIBITED_PRODUCT', label: 'Prohibited or illegal product' },
  { value: 'MISLEADING_DESCRIPTION', label: 'Misleading product description' },
  { value: 'FRAUDULENT_LISTING', label: 'Fake or fraudulent listing' },
  { value: 'INCORRECT_PRICING', label: 'Incorrect pricing or information' },
  { value: 'COPYRIGHT_CONCERN', label: 'Copyright or intellectual property concern' },
  { value: 'OTHER', label: 'Other' },
] as const;

export async function submitBusinessReport(
  storeId: string,
  reason: string,
  description: string
): Promise<{ reportId: string }> {
  const { data, error } = await supabase.rpc('create_business_report', {
    p_store_id: storeId,
    p_reason: reason,
    p_description: description.trim(),
  });
  if (error) throw new Error(error.message);
  return { reportId: data?.report_id || '' };
}

export async function submitProductReport(
  productId: string,
  reason: string,
  description: string
): Promise<{ reportId: string }> {
  const { data, error } = await supabase.rpc('create_product_report', {
    p_product_id: productId,
    p_reason: reason,
    p_description: description.trim(),
  });
  if (error) throw new Error(error.message);
  return { reportId: data?.report_id || '' };
}

// ---------------------------------------------------------------------------
// Help & Support Tickets (mirrors support.html)
// ---------------------------------------------------------------------------
export const SUPPORT_CATEGORIES = [
  { value: 'ACCOUNT_PROBLEMS', label: 'Account Problems' },
  { value: 'LOGIN_AUTHENTICATION', label: 'Login & Authentication' },
  { value: 'BUSINESS_VERIFICATION', label: 'Business Verification' },
  { value: 'STORE_MANAGEMENT', label: 'Store Management' },
  { value: 'PRODUCT_LISTINGS', label: 'Product Listings' },
  { value: 'REPORTS_MODERATION', label: 'Reports & Moderation' },
  { value: 'PAYMENTS_PRICING', label: 'Payments or Pricing' },
  { value: 'TECHNICAL_ISSUES', label: 'Technical Issues' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const SUPPORT_CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  SUPPORT_CATEGORIES.map((c) => [c.value, c.label])
);

export const SUPPORT_STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: 'Open', tone: 'info' },
  IN_PROGRESS: { label: 'In Progress', tone: 'warn' },
  WAITING_FOR_USER: { label: 'Waiting for You', tone: 'warn' },
  RESOLVED: { label: 'Resolved', tone: 'ok' },
  CLOSED: { label: 'Closed', tone: 'muted' },
};

export const SUPPORT_FAQS = [
  {
    q: 'How do I register as a business owner?',
    a: 'Choose "Business owner" when signing up for a PaliTrento account. Fill in your business details, pin your store location on the map, upload a storefront photo and your three permits, and submit for Admin verification. Once approved, you can add products and manage orders.',
  },
  {
    q: 'What documents are required for business verification?',
    a: 'Three permits are required with every store application: (1) Barangay Business Clearance, (2) Community Tax Certificate (Cedula), and (3) Business Permit. Upload each permit in Store Setup before submitting your application.',
  },
  {
    q: 'How long does verification take?',
    a: 'Admin typically reviews submissions within 3–5 business days. You will be notified when your store and permits are approved or if clarification is needed.',
  },
  {
    q: 'How do I add products to my store?',
    a: 'After your store is verified, open the Store tab and tap "Add product". Fill in the details and upload up to 3 photos. The first 15 listings are free; each additional listing costs ₱1, or you can upgrade to Premium for unlimited listings.',
  },
  {
    q: 'How do I receive orders?',
    a: 'When a customer reserves a product, it appears in your Store tab under Orders. You can confirm, mark as ready for pickup, or complete the order, and use chat to message the buyer.',
  },
  {
    q: 'What payment methods are supported?',
    a: 'Currently Cash and GCash are supported. Payment is settled at the store when the customer picks up their reserved order.',
  },
  {
    q: 'How do I report a business or product?',
    a: 'On any verified store or product page, tap "Report Business" or "Report Product". Select a reason and provide details so administrators can review and take action.',
  },
  {
    q: 'My account was suspended. What do I do?',
    a: 'If your account is temporarily suspended, the account status screen displays the expiration date and reason. Access is automatically restored when the suspension expires. For permanent bans, contact admin@palitrento.online to appeal.',
  },
  {
    q: 'How do I change my password?',
    a: 'Go to Profile → Profile & Settings → Change Password. Enter a new password with at least 8 characters including uppercase, lowercase, a number, and a special character.',
  },
  {
    q: 'Can I delete my account?',
    a: 'Account deletion permanently removes your data and cannot be undone. You can also submit a support request here or contact admin@palitrento.online if you need assistance with your account.',
  },
];

export interface SupportMessage {
  id: string;
  sender_id: string;
  content: string;
  is_from_admin: boolean;
  read_at?: string | null;
  created_at: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  resolved_at?: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  support_messages?: SupportMessage[];
}

export async function getMySupportTickets(userId: string): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*, support_messages(id, sender_id, content, is_from_admin, read_at, created_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as SupportTicket[];
}

export async function getSupportTicketDetail(
  userId: string,
  ticketId: string
): Promise<SupportTicket | null> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select(
      '*, support_messages(id, sender_id, content, is_from_admin, read_at, created_at, attachment_path, attachment_name)'
    )
    .eq('id', ticketId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;

  const ticket = data as SupportTicket;
  const messages = [...(ticket.support_messages || [])].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
  );
  ticket.support_messages = messages;

  // Mark unread admin replies as read
  const unreadIds = messages.filter((m) => m.is_from_admin && !m.read_at).map((m) => m.id);
  if (unreadIds.length > 0) {
    await supabase
      .from('support_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);
  }

  return ticket;
}

export async function uploadSupportAttachment(
  userId: string,
  uri: string,
  fileName: string,
  mimeType: string
): Promise<{ path: string; name: string; size: number; mime: string }> {
  const res = await fetch(uri);
  const body = await res.arrayBuffer();
  if (body.byteLength > 5 * 1024 * 1024) {
    throw new Error('Attachment must be under 5 MB.');
  }
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/support/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from('support-attachments')
    .upload(path, body, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);
  return { path, name: safeName, size: body.byteLength, mime: mimeType };
}

export async function createSupportTicket(input: {
  subject: string;
  category: string;
  description: string;
  attachment?: { path: string; name: string; size: number; mime: string } | null;
}): Promise<{ ticketId: string }> {
  const { data, error } = await supabase.rpc('create_support_ticket', {
    p_subject: input.subject.trim(),
    p_category: input.category,
    p_description: input.description.trim(),
    p_attachment_path: input.attachment?.path || null,
    p_attachment_name: input.attachment?.name || null,
    p_attachment_size: input.attachment?.size || null,
    p_attachment_mime: input.attachment?.mime || null,
  });
  if (error) throw new Error(error.message);
  return { ticketId: data?.ticket_id || '' };
}

export async function replyToSupportTicket(ticketId: string, content: string): Promise<void> {
  const { error } = await supabase.rpc('add_support_message', {
    p_ticket_id: ticketId,
    p_content: content.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function getSupportAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('support-attachments')
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not open attachment');
  return data.signedUrl;
}

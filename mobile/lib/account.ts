import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ---------------------------------------------------------------------------
// Email verification codes — same edge functions as the website (email-otp.js)
// ---------------------------------------------------------------------------
async function callFunction(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(body),
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {}
  return { ok: res.ok, data };
}

export async function sendEmailCode(email: string, purpose = 'verify'): Promise<{ error: string | null; code?: string }> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const { ok, data } = await callFunction('send-email-otp', { email, code, purpose });
  if (!ok) {
    return {
      error: data?.code === 'EMAIL_ALREADY_REGISTERED' ? data.error : data?.error || 'Failed to send verification code.',
      code: data?.code,
    };
  }
  return { error: null };
}

export async function verifyEmailCode(email: string, code: string, purpose = 'verify'): Promise<boolean> {
  const { ok, data } = await callFunction('verify-email-otp', { email, code, purpose });
  return ok && data?.valid === true;
}

// ---------------------------------------------------------------------------
// Password rules — mirrors PASSWORD_REQUIREMENTS in the website's ui.js
// ---------------------------------------------------------------------------
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'One lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number', label: 'One number (0-9)', test: (p: string) => /\d/.test(p) },
  { key: 'special', label: 'One special character (!@#$...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordStrength(password: string) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const valid = passed === PASSWORD_RULES.length;
  const label = !password ? '' : passed <= 2 ? 'Weak' : passed <= 4 ? 'Fair' : 'Strong';
  return { passed, total: PASSWORD_RULES.length, valid, label };
}

// ---------------------------------------------------------------------------
// Account restrictions (suspended / banned) — same rules as getSessionWithStatus
// ---------------------------------------------------------------------------
export interface Restriction {
  kind: 'banned' | 'suspended';
  until: string | null;
  since: string | null;
  reason: string | null;
}

export function getRestriction(profile: Record<string, any> | null | undefined): Restriction | null {
  if (!profile) return null;
  if (profile.account_status === 'banned') {
    return { kind: 'banned', until: null, since: profile.banned_at ?? null, reason: profile.ban_reason ?? null };
  }
  if (profile.account_status === 'suspended') {
    const until = profile.suspended_until ? new Date(profile.suspended_until).getTime() : null;
    if (until == null || until > Date.now()) {
      return {
        kind: 'suspended',
        until: profile.suspended_until ?? null,
        since: profile.suspended_at ?? null,
        reason: profile.suspension_reason ?? null,
      };
    }
  }
  return null;
}

export function isExpiredSuspension(profile: Record<string, any> | null | undefined): boolean {
  return (
    profile?.account_status === 'suspended' &&
    !!profile.suspended_until &&
    new Date(profile.suspended_until).getTime() <= Date.now()
  );
}

export async function restoreExpiredSuspensions() {
  try {
    await supabase.rpc('auto_restore_expired_suspensions');
  } catch {}
}

/** Supabase rejects restricted logins with these messages before a session exists. */
export function isRestrictedAuthError(message: string | null | undefined): boolean {
  const m = (message || '').toLowerCase();
  return m.includes('banned') || m.includes('suspended') || m.includes('restricted');
}

// ---------------------------------------------------------------------------
// Google sign-in: new accounts must pick Customer or Business owner
// ---------------------------------------------------------------------------
export const GOOGLE_ROLE_PENDING_KEY = 'palitrento_google_role_pending';

export function isNewGoogleAccount(user: any): boolean {
  if (user?.app_metadata?.provider !== 'google') return false;
  const created = Date.parse(user.created_at ?? '');
  const lastSignIn = Date.parse(user.last_sign_in_at ?? '');
  return Number.isFinite(created) && Number.isFinite(lastSignIn) && Math.abs(lastSignIn - created) <= 2 * 60 * 1000;
}

export async function completeGoogleRegistration(role: 'customer' | 'business_owner') {
  const { error } = await supabase.rpc('complete_google_account_registration', { p_role: role });
  if (error) throw error;
}

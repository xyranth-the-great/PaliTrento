import { supabase } from './supabase.js';

const SEND_OTP_URL = `${supabase?.supabaseUrl || ''}/functions/v1/send-email-otp`;
const VERIFY_OTP_URL = `${supabase?.supabaseUrl || ''}/functions/v1/verify-email-otp`;

export async function sendEmailOTP(email, purpose = 'verify') {
  if (!supabase) {
    return { error: new Error('Supabase not configured') };
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  const res = await fetch(SEND_OTP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabase.supabaseKey}`,
    },
    body: JSON.stringify({ email, code, purpose }),
  });

  const data = await res.json();

  if (!res.ok) {
    return { error: new Error(data.error || 'Failed to send code'), code: null };
  }

  return { error: null, code };
}

export async function verifyEmailOTP(email, code, purpose = 'verify') {
  if (!supabase) {
    return { error: new Error('Supabase not configured'), valid: false };
  }

  const res = await fetch(VERIFY_OTP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabase.supabaseKey}`,
    },
    body: JSON.stringify({ email, code, purpose }),
  });

  const data = await res.json();

  if (!res.ok) {
    return { error: new Error(data.error || 'Invalid or expired code'), valid: false };
  }

  return { error: null, valid: data.valid };
}

export async function resendEmailOTP(email, purpose = 'verify') {
  return sendEmailOTP(email, purpose);
}
import { renderChrome, $ } from './ui.js';
import { supabase } from './supabase.js';

function logDebug(msg, type = 'info') {
  console.log('[auth-status]', msg);
  const el = $('#debug-log');
  if (el) {
    const line = document.createElement('div');
    line.className = 'debug-line';
    if (type === 'error') line.classList.add('debug-error');
    if (type === 'success') line.classList.add('debug-success');
    if (type === 'warn') line.classList.add('debug-warning');
    line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }
}

function getEmailFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('email')?.toLowerCase();
}

async function checkProfileByEmail(email) {
  logDebug('Checking profile for email: ' + email);

  try {
    logDebug('Querying profiles table for email: ' + email);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('account_status, suspended_until, suspension_reason, suspended_at, banned_at, ban_reason, email')
      .eq('email', email)
      .maybeSingle();

    logDebug('Query result - error: ' + (error?.message || 'none') + ', profile: ' + (profile ? 'found' : 'null'), error ? 'error' : 'success');

    if (error) {
      logDebug('ERROR: Profile query failed: ' + error.message, 'error');
      return;
    }

    if (!profile) {
      logDebug('Profile not found for email: ' + email, 'warn');
      return;
    }

    logDebug('Profile found: account_status=' + profile.account_status + ', suspended_until=' + (profile.suspended_until || 'null'), 'success');

    const now = Date.now();

    if (profile.account_status === 'banned') {
      logDebug('Account is BANNED - redirecting to /banned/', 'success');
      window.location.replace('/banned/');
      return;
    }

    if (profile.account_status === 'suspended') {
      if (profile.suspended_until && new Date(profile.suspended_until).getTime() <= now) {
        logDebug('Suspension expired - triggering auto-restore...', 'warn');
        try {
          await supabase.rpc('auto_restore_expired_suspensions');
          logDebug('Auto-restore called, reloading...');
        } catch (e) {
          logDebug('Auto-restore failed: ' + e);
        }
        window.location.reload();
        return;
      }
      logDebug('Account is SUSPENDED - redirecting to /suspended/', 'success');
      window.location.replace('/suspended/');
      return;
    }

    logDebug('Account is ACTIVE - redirecting to /', 'info');
    window.location.href = '/';
    return;

  } catch (err) {
    logDebug('EXCEPTION: ' + err, 'error');
  }
}

async function checkAccountStatus() {
  logDebug('Starting auth status check...');

  const urlEmail = getEmailFromUrl();
  if (urlEmail) {
    logDebug('Email from URL param: ' + urlEmail);
    await checkProfileByEmail(urlEmail);
    return;
  }

  logDebug('No URL email, checking session...');

  if (!supabase) {
    logDebug('ERROR: Supabase not configured', 'error');
    return;
  }

  logDebug('Getting session...');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    logDebug('Session error: ' + sessionError.message, 'error');
    window.location.href = '/login/';
    return;
  }

  if (!session) {
    logDebug('No active session - redirecting to login', 'warn');
    window.location.href = '/login/';
    return;
  }

  logDebug('Session found for user: ' + session.user.id);

  const sessionEmail = session.user.email?.toLowerCase();
  if (!sessionEmail) {
    logDebug('ERROR: No email in session', 'error');
    window.location.href = '/login/';
    return;
  }

  logDebug('Email from session: ' + sessionEmail);
  await checkProfileByEmail(sessionEmail);
}

checkAccountStatus();
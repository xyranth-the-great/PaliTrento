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

function showResult(obj) {
  const box = $('#result-box');
  if (box) {
    box.style.display = 'block';
    box.textContent = JSON.stringify(obj, null, 2);
  }
}

function showActions(profile) {
  const actions = $('#actions');
  if (!actions) return;
  actions.style.display = 'block';
  const suspendedBtn = $('#goto-suspended');
  const bannedBtn = $('#goto-banned');
  const loginBtn = $('#goto-login');

  if (profile.account_status === 'suspended') {
    suspendedBtn.style.display = 'inline-block';
    bannedBtn.style.display = 'none';
    loginBtn.style.display = 'none';
  } else if (profile.account_status === 'banned') {
    suspendedBtn.style.display = 'none';
    bannedBtn.style.display = 'inline-block';
    loginBtn.style.display = 'none';
  } else {
    suspendedBtn.style.display = 'none';
    bannedBtn.style.display = 'none';
    loginBtn.style.display = 'inline-block';
  }
}

async function checkProfileByEmail(email) {
  logDebug('Checking profile for email: ' + email);

  try {
    logDebug('Querying profiles table for email: ' + email);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('account_status, suspended_until, suspension_reason, suspended_at, banned_at, ban_reason, email, id')
      .eq('email', email)
      .maybeSingle();

    logDebug('Query result - error: ' + (error?.message || 'none') + ', profile: ' + (profile ? 'found' : 'null'), error ? 'error' : 'success');

    if (error) {
      logDebug('ERROR: Profile query failed: ' + error.message, 'error');
      showResult({ error: error.message, hint: 'Check RLS policies or email column' });
      return;
    }

    if (!profile) {
      logDebug('Profile not found for email: ' + email, 'warn');
      showResult({ error: 'Profile not found', email: email, hint: 'Check email spelling or run add-profile-email.sql migration' });
      return;
    }

    logDebug('Profile found: account_status=' + profile.account_status + ', suspended_until=' + (profile.suspended_until || 'null'), 'success');
    showResult(profile);
    showActions(profile);

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
    showResult({ exception: String(err) });
  }
}

function getEmailFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('email')?.toLowerCase();
}

async function checkAccountStatus() {
  logDebug('Starting auth status check...');

  // PRIORITY 1: Check URL param first (for login redirect flow)
  const urlEmail = getEmailFromUrl();
  if (urlEmail) {
    logDebug('Email from URL param: ' + urlEmail);
    await checkProfileByEmail(urlEmail);
    return;
  }

  // PRIORITY 2: Check session (for protected page redirects)
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

  // Get email from session
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
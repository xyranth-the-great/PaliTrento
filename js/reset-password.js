import { renderChrome, $, esc } from './ui.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getAuthErrorMessage, getSession, getCachedProfile } from './auth.js';

const form = $('#reset-form');
const msgEl = $('#reset-message');
let recoverySessionReady = false;

async function init() {
  // Check if we have a valid session from the password reset link FIRST, before rendering chrome
  // Supabase puts the token in the URL hash when redirecting from the email
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const type = hashParams.get('type');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  let session = null;
  let profile = null;

  if (!isSupabaseConfigured()) {
    form.innerHTML = `<p class="muted" style="padding:24px;background:var(--muted-bg);border-radius:var(--r-lg)">${esc('Password reset is not available right now')}</p>`;
    // Still render chrome without session
    renderChrome('reset-password.html', null, null);
    return;
  }

  if (type === 'recovery' && accessToken && refreshToken) {
    console.log('[ResetPassword] Found recovery tokens in hash, setting session...');
    // Set the session from the recovery tokens
    const { error, data } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) {
      console.error('[ResetPassword] Failed to set recovery session:', error);
      showMsg('This reset link is invalid or has expired. Please request a new one.', 'bad');
      form.style.display = 'none';
      renderChrome('reset-password.html', null, null);
      return;
    }
    console.log('[ResetPassword] Session set successfully, user:', data.session?.user?.id);
    session = data.session;
    recoverySessionReady = true;
    // Clear the hash from URL for cleanliness
    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    // No valid recovery token in URL - might be a direct visit
    // Check if user already has a session (logged in)
    session = await getSession();
    if (!session) {
      console.log('[ResetPassword] No session found, showing error');
      showMsg('This link is invalid or has expired. Please request a new password reset.', 'bad');
      form.style.display = 'none';
      renderChrome('reset-password.html', null, null);
      return;
    }
    recoverySessionReady = true;
  }

  if (session) {
    profile = await getCachedProfile(session.user.id);
  }
  renderChrome('reset-password.html', session, profile);
}

init();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.textContent = '';
  msgEl.className = 'muted';

  // Ensure recovery session is ready
  if (!recoverySessionReady) {
    showMsg('Session not ready. Please refresh the page and try again.', 'bad');
    return;
  }

  // Verify we have a valid session
  const session = await getSession();
  if (!session) {
    showMsg('Session expired. Please request a new password reset link.', 'bad');
    return;
  }

  const password = form.password.value;
  const confirmPassword = form.confirm_password.value;

  if (!password || !confirmPassword) {
    showMsg('Please fill in both fields', 'bad');
    return;
  }
  if (password.length < 8) {
    showMsg('Password must be at least 8 characters', 'bad');
    return;
  }
  if (password !== confirmPassword) {
    showMsg('Passwords do not match', 'bad');
    return;
  }

  if (!supabase) {
    showMsg('Password reset is not available right now.', 'bad');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating...';

  try {
    console.log('[ResetPassword] Updating password for user:', session.user.id);
    const { error } = await supabase.auth.updateUser({ password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Update password';

    if (error) {
      console.error('[ResetPassword] Reset password error:', error.message, error.status, error);
      showMsg(getAuthErrorMessage(error), 'bad');
      return;
    }

    console.log('[ResetPassword] Password updated successfully');
    showMsg('Password updated successfully! Redirecting to login...', 'ok');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Update password';
    console.error('[ResetPassword] Reset password exception:', err);
    showMsg('Something went wrong. Please try again.', 'bad');
  }
});

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
}
import { $, esc } from './ui.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getAuthErrorMessage } from './auth.js';

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

  if (!isSupabaseConfigured()) {
    form.innerHTML = `<p class="muted" style="padding:24px;background:var(--muted-bg);border-radius:var(--r-lg)">${esc('Password reset is not available right now')}</p>`;
    return;
  }

  if (type !== 'recovery' || !accessToken || !refreshToken) {
    showMsg('This reset link is invalid or has expired. Please request a new password reset.', 'bad');
    form.style.display = 'none';
    return;
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  if (error) {
    console.error('[ResetPassword] Failed to set recovery session:', error);
    showMsg('This reset link is invalid or has expired. Please request a new one.', 'bad');
    form.style.display = 'none';
    return;
  }

  recoverySessionReady = true;
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
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

    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) {
      console.error('[ResetPassword] Password updated, but local sign-out failed:', signOutError);
      showMsg('Your password was updated, but this browser session could not be ended. Please log out before continuing.', 'bad');
      return;
    }

    console.log('[ResetPassword] Password updated successfully');
    showMsg('Password updated. Please log in with your new password.', 'ok');
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
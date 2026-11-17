import { $, esc, checkPasswordStrength, createPasswordStrengthIndicator, initPasswordStrength } from './ui.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getAuthErrorMessage, getSession, checkAuthErrorParams } from './auth.js';

const form = $('#reset-form');
const msgEl = $('#reset-message');
let recoverySessionReady = false;

// Check for auth error params from Supabase redirect (before hash parsing)
const authErrorRedirect = checkAuthErrorParams();
if (authErrorRedirect) {
  window.location.replace(authErrorRedirect);
}

async function init() {
  // Check if we have a valid session from the password reset link FIRST, before rendering chrome
  // Supabase puts the token in the URL hash when redirecting from the email
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const type = hashParams.get('type');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const searchParams = new URLSearchParams(window.location.search);
  const hasPkceCode = searchParams.has('code');

  if (!isSupabaseConfigured()) {
    form.innerHTML = `<p class="muted" style="padding:24px;background:var(--muted-bg);border-radius:var(--r-lg)">${esc('Password reset is not available right now')}</p>`;
    return;
  }

  if (type === 'recovery' && accessToken && refreshToken) {
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
  } else if (hasPkceCode) {
    // Supabase's PKCE flow exchanges the URL code during client initialization.
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      console.error('[ResetPassword] Failed to load PKCE recovery session:', error);
      showMsg('This reset link is invalid or has expired. Please request a new one.', 'bad');
      form.style.display = 'none';
      return;
    }
  } else {
    showMsg('This reset link is invalid or has expired. Please request a new password reset.', 'bad');
    form.style.display = 'none';
    return;
  }

  recoverySessionReady = true;
  searchParams.delete('code');
  const cleanSearch = searchParams.toString();
  const cleanUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`;
  window.history.replaceState(window.history.state, document.title, cleanUrl);

  // Inject password strength indicator
  const pwContainer = $('#password-strength-container');
  if (pwContainer) {
    pwContainer.innerHTML = createPasswordStrengthIndicator('password');
    initPasswordStrength('password', { showRequirements: true });
  }
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

  // Use shared password validation
  const pwdResult = checkPasswordStrength(password);
  if (!pwdResult.valid) {
    showMsg('Password must include: ' + pwdResult.errors.join(', '), 'bad');
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
      window.location.href = '/login/';
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
import { renderChrome, $, esc } from './ui.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getAuthErrorMessage, getSession, getCachedProfile } from './auth.js';

const form = $('#reset-form');
const msgEl = $('#reset-message');

async function init() {
  const session = await getSession();
  let profile = null;
  if (session) profile = await getCachedProfile(session.user.id);
  renderChrome('reset-password.html', session, profile);

  if (!isSupabaseConfigured()) {
    form.innerHTML = `<p class="muted" style="padding:24px;background:var(--muted-bg);border-radius:var(--r-lg)">${esc('Password reset is not available right now')}</p>`;
    return;
  }

  // Check if we have a valid session from the password reset link
  // Supabase puts the token in the URL hash when redirecting from the email
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const type = hashParams.get('type');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (type === 'recovery' && accessToken && refreshToken) {
    // Set the session from the recovery tokens
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) {
      console.error('Failed to set recovery session:', error);
      showMsg('This reset link is invalid or has expired. Please request a new one.', 'bad');
      form.style.display = 'none';
      return;
    }
    // Clear the hash from URL for cleanliness
    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    // No valid recovery token in URL - might be a direct visit
    // Check if user already has a session (logged in)
    const currentSession = await getSession();
    if (!currentSession) {
      showMsg('This link is invalid or has expired. Please request a new password reset.', 'bad');
      form.style.display = 'none';
      return;
    }
  }
}

init();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.textContent = '';
  msgEl.className = 'muted';

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
    const { error } = await supabase.auth.updateUser({ password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Update password';

    if (error) {
      console.error('Reset password error:', error.message, error.status, error);
      showMsg(getAuthErrorMessage(error), 'bad');
      return;
    }

    showMsg('Password updated successfully! Redirecting to login...', 'ok');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Update password';
    console.error('Reset password exception:', err);
    showMsg('Something went wrong. Please try again.', 'bad');
  }
});

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
}
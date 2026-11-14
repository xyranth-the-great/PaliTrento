import { renderChrome, $, esc } from './ui.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getAuthErrorMessage, getSession, getCachedProfile } from './auth.js';

const form = $('#forgot-form');
const msgEl = $('#forgot-message');

async function init() {
  const session = await getSession();
  let profile = null;
  if (session) profile = await getCachedProfile(session.user.id);
  renderChrome('/forgot-password/', session, profile);

  if (!isSupabaseConfigured()) {
    form.innerHTML = `<p class="muted" style="padding:24px;background:var(--muted-bg);border-radius:var(--r-lg)">${esc('Password reset is not available right now')}</p>`;
  }
}

init();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.textContent = '';
  msgEl.className = 'muted';

  const email = form.email.value.trim().toLowerCase();

  if (!email) {
    showMsg('Please enter your email address', 'bad');
    return;
  }

  if (!supabase) {
    showMsg('Password reset is not available right now. Configure Supabase keys in .env.', 'bad');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  try {
    // Supabase only redirects to URLs on its allowlist; use the canonical HTTPS production URL.
    const redirectUrl = new URL('/reset-password/', window.location.href);
    if (['palitrento.online', 'www.palitrento.online'].includes(redirectUrl.hostname)) {
      redirectUrl.href = 'https://palitrento.online/reset-password.html';
    }
    const redirectTo = redirectUrl.href;

    console.log('[ForgotPassword] Requesting reset for:', email);
    console.log('[ForgotPassword] redirectTo:', redirectTo);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Send reset link';

    if (error) {
      console.error('[ForgotPassword] Forgot password error:', error.message, error.status, error);
      showMsg(getAuthErrorMessage(error), 'bad');
      return;
    }

    console.log('[ForgotPassword] Reset email sent successfully');
    // Don't reveal if email exists or not (security best practice)
    showMsg('If an account exists for that email, a reset link has been sent.', 'ok');
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send reset link';
    console.error('[ForgotPassword] Forgot password exception:', err);
    showMsg('Something went wrong. Please try again.', 'bad');
  }
});

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
}
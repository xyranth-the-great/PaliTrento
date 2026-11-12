import { renderChrome, $, esc } from './ui.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getAuthErrorMessage, getSession, getCachedProfile } from './auth.js';

const form = $('#forgot-form');
const msgEl = $('#forgot-message');

async function init() {
  const session = await getSession();
  let profile = null;
  if (session) profile = await getCachedProfile(session.user.id);
  renderChrome('forgot-password.html', session, profile);

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
    // Use the production URL for the redirect - Supabase will append the token as hash params
    const redirectTo = `${window.location.origin}${window.location.pathname.replace('forgot-password.html', 'reset-password.html')}`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Send reset link';

    if (error) {
      console.error('Forgot password error:', error.message, error.status, error);
      showMsg(getAuthErrorMessage(error), 'bad');
      return;
    }

    // Don't reveal if email exists or not (security best practice)
    showMsg('If an account exists for that email, a reset link has been sent.', 'ok');
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send reset link';
    console.error('Forgot password exception:', err);
    showMsg('Something went wrong. Please try again.', 'bad');
  }
});

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
}
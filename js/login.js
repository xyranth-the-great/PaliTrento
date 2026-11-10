import { renderChrome, $, esc } from './ui.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getAuthErrorMessage, getSession, getCachedProfile } from './auth.js';

const form = $('#login-form');
const msgEl = $('#login-message');

async function init() {
  const session = await getSession();
  let profile = null;
  if (session) profile = await getCachedProfile(session.user.id);
  renderChrome('login.html', session, profile);

  if (!isSupabaseConfigured()) {
    form.innerHTML = `<p class="muted" style="padding:24px;background:var(--muted-bg);border-radius:var(--r-lg)">${esc('Login is not available right now')}</p>`;
  }
}

init();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.textContent = '';
  msgEl.className = 'muted';

  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;

  if (!email || !password) {
    showMsg('Please enter email and password', 'bad');
    return;
  }

  if (!supabase) {
    showMsg('Login is not available right now. Configure Supabase keys in .env.', 'bad');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Log in';

    if (error) {
      console.error('Login error:', error.message, error.status, error);
      showMsg(getAuthErrorMessage(error), 'bad');
      return;
    }

    if (data.session) {
      // Check user role for redirect
      const profile = await getCachedProfile(data.session.user.id);
      const role = profile?.role || data.session.user.user_metadata?.role;
      if (role === 'business_owner') {
        window.location.href = 'dashboard.html';
      } else if (role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'index.html';
      }
    } else if (data.user && !data.user.email_confirmed_at) {
      showMsg('Account not confirmed. Please verify your email first.', 'warn');
    } else {
      showMsg('Check your email to confirm your account.', 'ok');
    }
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log in';
    console.error('Login exception:', err);
    showMsg('Something went wrong. Please try again.', 'bad');
  }
});

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
}
import { renderChrome, $, esc } from './ui.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getAuthErrorMessage, getSession, getPostLoginPath, onAuthStateChange } from './auth.js';

const form = $('#login-form');
const msgEl = $('#login-message');
const googleBtn = $('#google-login-btn');

async function init() {
  const session = await getSession();
  if (session) {
    redirectAfterLogin(session.user.user_metadata?.role);
    return;
  }

  renderChrome('login.html');

  if (!isSupabaseConfigured()) {
    form.innerHTML = `<p class="muted" style="padding:24px;background:var(--muted-bg);border-radius:var(--r-lg)">${esc('Login is not available right now')}</p>`;
    if (googleBtn) googleBtn.style.display = 'none';
  }
}

let redirectStarted = false;

function redirectAfterLogin(role) {
  if (redirectStarted) return;
  redirectStarted = true;
  window.location.replace(getPostLoginPath(role));
}

onAuthStateChange((event, session) => {
  if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
    redirectAfterLogin(session.user.user_metadata?.role);
  }
});

init();

// Google OAuth login
if (googleBtn && supabase) {
  googleBtn.addEventListener('click', async () => {
    googleBtn.disabled = true;
    googleBtn.innerHTML = `
      <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" style="animation:spin 1s linear infinite" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="30 60" stroke-linecap="round"/>
      </svg>
      <span>Redirecting...</span>
    `;

    try {
      const redirectUrl = new URL('index.html', window.location.href).href;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('Google login error:', error);
        showMsg('Failed to start Google login. Please try again.', 'bad');
      }
      // Redirect happens automatically via Supabase
    } catch (err) {
      console.error('Google login exception:', err);
      showMsg('Something went wrong. Please try again.', 'bad');
    } finally {
      googleBtn.disabled = false;
      googleBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>Continue with Google</span>
      `;
    }
  });
}

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
      const profile = await getCachedProfile(data.session.user.id);
      redirectAfterLogin(profile?.role || data.session.user.user_metadata?.role);
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
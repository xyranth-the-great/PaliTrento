import { renderChrome, $, esc, BARANGAYS } from './ui.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getAuthErrorMessage, getSession, getCachedProfile } from './auth.js';
import { sendEmailOTP } from './email-otp.js';

const form = $('#register-form');
const msgEl = $('#register-message');
const showPasswordCheckbox = $('#show-password');
const googleBtn = $('#google-register-btn');

showPasswordCheckbox.addEventListener('change', () => {
  const inputType = showPasswordCheckbox.checked ? 'text' : 'password';
  form.password.type = inputType;
  form.confirm_password.type = inputType;
});

// Google OAuth register
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
      const redirectUrl = new URL('store-setup.html?step=1', window.location.href).href;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('Google register error:', error);
        showMsg('Failed to start Google login. Please try again.', 'bad');
      }
      // Redirect happens automatically via Supabase
    } catch (err) {
      console.error('Google register exception:', err);
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

async function init() {
  const session = await getSession();
  let profile = null;
  if (session) profile = await getCachedProfile(session.user.id);
  renderChrome('register-business.html', session, profile);

  // Populate barangay dropdown
  const brgySelect = $('#barangay');
  brgySelect.innerHTML = '<option value="">Choose your barangay</option>' +
    BARANGAYS.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');

  if (!isSupabaseConfigured()) {
    form.innerHTML = `<p class="muted" style="padding:24px;background:var(--muted-bg);border-radius:var(--r-lg)">${esc('Login is not available right now')}</p>`;
  }
}

init();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.textContent = '';
  msgEl.className = 'muted';

  const fullName = form.full_name.value.trim();
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const confirmPassword = form.confirm_password.value;
  const barangay = form.barangay.value;

  if (!form.accept_terms.checked) {
    showMsg('Please agree to the Terms and Agreement before creating an account', 'bad');
    return;
  }

  if (!fullName || !email || !password) {
    showMsg('Please fill in all required fields', 'bad');
    return;
  }
  if (password.length < 8) {
    showMsg('Password must be at least 8 characters', 'bad');
    return;
  }
  if (!/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    showMsg('Password must include at least one number and one special character', 'bad');
    return;
  }
  if (password !== confirmPassword) {
    showMsg('Passwords do not match', 'bad');
    return;
  }

  if (!supabase) {
    showMsg('Login is not available right now. Configure Supabase keys in .env.', 'bad');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending code...';

  try {
    // Store registration data for after verification
    sessionStorage.setItem('pending_registration', JSON.stringify({
      full_name: fullName,
      password,
      role: 'business_owner',
      barangay: barangay || null,
      timestamp: Date.now()
    }));

    // Send OTP code
    const { error } = await sendEmailOTP(email, 'verify');

    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account & continue';

    if (error) {
      sessionStorage.removeItem('pending_registration');
      showMsg(
        error.code === 'EMAIL_ALREADY_REGISTERED'
          ? error.message
          : 'Failed to send verification code. Please try again.',
        'bad'
      );
      return;
    }

    // Redirect to verify page, then to store setup
    window.location.href = `verify.html?email=${encodeURIComponent(email)}&purpose=verify&next=store-setup`;
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account & continue';
    console.error('Register error:', err);
    showMsg('Something went wrong. Please try again.', 'bad');
  }
});

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
}

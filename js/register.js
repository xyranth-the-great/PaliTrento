import { renderChrome, $, esc, BARANGAYS } from './ui.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getAuthErrorMessage, getSession, getCachedProfile } from './auth.js';
import { sendEmailOTP } from './email-otp.js';

const form = $('#register-form');
const msgEl = $('#register-message');

async function init() {
  const session = await getSession();
  let profile = null;
  if (session) profile = await getCachedProfile(session.user.id);
  renderChrome('register.html', session, profile);

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
  const role = form.role.value;
  const barangay = form.barangay.value;

  if (!fullName || !email || !password) {
    showMsg('Please fill in all required fields', 'bad');
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
  if (!['customer', 'business_owner'].includes(role)) {
    showMsg('Invalid role', 'bad');
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
      role,
      barangay: barangay || null,
      timestamp: Date.now()
    }));

    console.log('[Register] Sending OTP to:', email);
    // Send OTP code
    const { error } = await sendEmailOTP(email, 'verify');

    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';

    if (error) {
      console.error('[Register] OTP error:', error);
      showMsg('Failed to send verification code. Please try again.', 'bad');
      return;
    }

    // Redirect to verify page
    const verifyUrl = `verify.html?email=${encodeURIComponent(email)}&purpose=verify`;
    console.log('[Register] Redirecting to:', verifyUrl);
    window.location.href = verifyUrl;
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';
    console.error('[Register] Exception:', err);
    showMsg('Something went wrong. Please try again.', 'bad');
  }
});

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
}
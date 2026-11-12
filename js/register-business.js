import { renderChrome, $, esc, BARANGAYS } from './ui.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured, getAuthErrorMessage, getSession, getCachedProfile } from './auth.js';
import { sendEmailOTP } from './email-otp.js';

const form = $('#register-form');
const msgEl = $('#register-message');
const showPasswordCheckbox = $('#show-password');

showPasswordCheckbox.addEventListener('change', () => {
  const inputType = showPasswordCheckbox.checked ? 'text' : 'password';
  form.password.type = inputType;
  form.confirm_password.type = inputType;
});

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
      showMsg('Failed to send verification code. Please try again.', 'bad');
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

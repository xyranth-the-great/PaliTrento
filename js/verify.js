import { renderChrome, $, esc } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
import { sendEmailOTP, verifyEmailOTP, resendEmailOTP } from './email-otp.js';
import { isSupabaseConfigured, getLoginUnavailableMessage } from './auth.js';

const form = $('#verify-form');
const msgEl = $('#verify-message');
const verifyBtn = $('#verify-btn');
const resendBtn = $('#resend-btn');
const resendSection = $('#resend-section');
const resendCooldown = $('#resend-cooldown');
const emailDisplay = $('#verify-email-display');

const urlParams = new URLSearchParams(window.location.search);
const email = urlParams.get('email')?.toLowerCase();
const purpose = urlParams.get('purpose') || 'verify';
const nextPage = urlParams.get('next') || 'login';

console.log('[Verify] URL:', window.location.href);
console.log('[Verify] Email param:', email);
console.log('[Verify] Purpose param:', purpose);
console.log('[Verify] Next param:', nextPage);

let resendCooldownTimer = null;
let cooldownSeconds = 0;

async function init() {
  const session = await getSession();
  let profile = null;
  if (session) profile = await getCachedProfile(session.user.id);
  renderChrome('verify.html', session, profile);

  if (!email) {
    showMsg('No email provided. Please register again.', 'bad');
    form.style.display = 'none';
    return;
  }

  emailDisplay.textContent = email;

  if (!isSupabaseConfigured()) {
    showMsg(getLoginUnavailableMessage(), 'warn');
    form.style.display = 'none';
    return;
  }

  // Auto-focus first input
  form.code1?.focus();

  // Input handling for 6-digit code
  const inputs = Array.from(form.querySelectorAll('input[name^="code"]'));
  inputs.forEach((input, i) => {
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/, '');
      if (e.target.value && i < inputs.length - 1) {
        inputs[i + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) {
        inputs[i - 1].focus();
      }
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
      pasted.split('').forEach((char, idx) => {
        if (inputs[idx]) inputs[idx].value = char;
      });
      const lastFilled = Math.min(pasted.length, inputs.length) - 1;
      if (lastFilled >= 0) inputs[lastFilled].focus();
    });
  });

  // Start with resend available after a short delay
  setTimeout(() => {
    resendSection.style.display = 'block';
  }, 5000);
}

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
}

function getCode() {
  const inputs = Array.from(form.querySelectorAll('input[name^="code"]'));
  return inputs.map(i => i.value).join('');
}

function clearCode() {
  const inputs = Array.from(form.querySelectorAll('input[name^="code"]'));
  inputs.forEach(i => i.value = '');
  inputs[0]?.focus();
}

function startResendCooldown(seconds = 60) {
  cooldownSeconds = seconds;
  resendBtn.disabled = true;
  resendCooldown.style.display = 'block';

  resendCooldownTimer = setInterval(() => {
    cooldownSeconds--;
    if (cooldownSeconds <= 0) {
      clearInterval(resendCooldownTimer);
      resendBtn.disabled = false;
      resendCooldown.style.display = 'none';
    } else {
      resendCooldown.textContent = `Resend available in ${cooldownSeconds}s`;
    }
  }, 1000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.style.display = 'none';

  const code = getCode();
  if (code.length !== 6) {
    showMsg('Please enter all 6 digits', 'bad');
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';

  try {
    const { error, valid } = await verifyEmailOTP(email, code, purpose);

    if (error || !valid) {
      showMsg('Invalid or expired code. Please try again.', 'bad');
      clearCode();
      return;
    }

    showMsg('Email verified! Redirecting...', 'ok');

    // For registration: sign up the user now
    if (purpose === 'verify') {
      const session = await getSession();
      // The register page should have stored pending registration data
      const pendingData = sessionStorage.getItem('pending_registration');
      if (pendingData) {
        const { full_name, password, role, barangay } = JSON.parse(pendingData);
        // Use supabase to sign up
        const { supabase } = await import('./supabase.js');
        const redirectUrl = new URL('login.html', window.location.href).href;
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name, role, barangay: barangay || null },
            emailRedirectTo: redirectUrl,
          },
        });
        if (signUpError) {
          showMsg('Verification succeeded but account creation failed. Please try logging in.', 'warn');
        } else {
          sessionStorage.removeItem('pending_registration');
          const redirectUrl = nextPage === 'store-setup' ? 'store-setup.html?step=1' : 'login.html?verified=1';
          setTimeout(() => window.location.href = redirectUrl, 1500);
          return;
        }
      }
    }

    const redirectUrl = nextPage === 'store-setup' ? 'store-setup.html?step=1' : 'login.html';
    setTimeout(() => window.location.href = redirectUrl, 1500);
  } catch (err) {
    console.error('Verify error:', err);
    showMsg('Something went wrong. Please try again.', 'bad');
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify';
  }
});

resendBtn.addEventListener('click', async () => {
  resendBtn.disabled = true;
  resendBtn.textContent = 'Sending...';

  try {
    const { error } = await resendEmailOTP(email, purpose);
    if (error) throw error;
    showMsg('Code sent! Check your email.', 'ok');
    startResendCooldown(60);
  } catch (err) {
    console.error('Resend error:', err);
    showMsg('Failed to resend. Please try again.', 'bad');
    resendBtn.disabled = false;
  } finally {
    resendBtn.textContent = 'Resend code';
  }
});

init();
import { renderChrome, $, esc, BARANGAYS, peso, updatePremiumIndicator, setPlanBadge, renderFreePlanUsage, attachPremiumLiquidShader, removePremiumLiquidShader } from './ui.js';
import { supabase } from './supabase.js';
import {
  getSessionWithStatus, getCachedProfile, updateProfile, uploadAvatar, deleteAvatar,
  signOut, onAuthStateChange, isSupabaseConfigured, getLoginUnavailableMessage, clearProfileCache, checkAuthErrorParams
} from './auth.js';

const contentEl = $('#account-content');
const msgEl = $('#account-message');
const form = $('#account-form');
const saveBtn = $('#save-btn');
const avatarPreview = $('#avatar-preview');
const avatarImg = $('#avatar-img');
const avatarPlaceholder = $('#avatar-placeholder');
const avatarInput = $('#avatar-input');
const avatarRemove = $('#avatar-remove');
const avatarMsg = $('#avatar-msg');
const premiumStatusPanel = $('#sub-premium-status');

let currentProfile = null;
let currentSession = null;
function setPremiumShader(active) {
  if (!premiumStatusPanel) return;
  if (active) attachPremiumLiquidShader(premiumStatusPanel);
  else removePremiumLiquidShader(premiumStatusPanel);
}

async function loadAccount() {
  if (!isSupabaseConfigured()) {
    showMsg(getLoginUnavailableMessage(), 'warn');
    return;
  }

  // Check for auth error params from Supabase redirect
  const authErrorRedirect = checkAuthErrorParams();
  if (authErrorRedirect) {
    window.location.replace(authErrorRedirect);
    return;
  }

  const { session, profile, redirectUrl } = await getSessionWithStatus();
  if (redirectUrl) {
    window.location.replace(redirectUrl);
    return;
  }
  if (!session) {
    window.location.href = '/login/';
    return;
  }

  currentSession = session;

  // Subscription and store-promotion features belong to seller accounts only.
  currentProfile = await getCachedProfile(session.user.id) || profile;
  const role = currentProfile?.role ?? session.user.user_metadata?.role ?? 'customer';
  const isSeller = role === 'business_owner';
  $('#tab-subscription').style.display = isSeller ? 'block' : 'none';
  renderChrome('/account/', session, getAccountDisplayProfile(currentProfile, role));

  await loadWarnings(session.user.id);

  if (isSeller) {
    await loadSubscriptionData(session.user.id);
  }

  // Populate barangay dropdown
  const brgySelect = $('#acc-barangay');
  brgySelect.innerHTML = '<option value="">Choose your barangay</option>' +
    BARANGAYS.map(b => `<option value="${esc(b)}"${currentProfile?.barangay === b ? ' selected' : ''}>${esc(b)}</option>`).join('');

  // Fill form fields
  $('#acc-name').value = currentProfile?.full_name ?? session.user.user_metadata?.full_name ?? '';
  $('#acc-email').value = currentProfile?.email ?? session.user.email ?? '';
  $('#acc-role').value = role.replace('_', ' ');
  $('#account-role-badge').textContent = role.replace('_', ' ');
  if (currentProfile?.barangay) brgySelect.value = currentProfile.barangay;

  // Show avatar
  updateAvatarPreview(currentProfile?.avatar_url ?? null);

  contentEl.style.display = 'block';
}

function getAccountDisplayProfile(profile, role = profile?.role) {
  if (role === 'business_owner') return profile;
  return { ...profile, is_premium: false, premium_details: null };
}

async function loadWarnings(userId) {
  const warningsEl = $('#account-warnings');
  const { data, error } = await supabase
    .from('account_moderation_actions')
    .select('id, reason, created_at')
    .eq('target_user_id', userId)
    .eq('action', 'warn')
    .order('created_at', { ascending: false });

  if (error || !data?.length) return;
  warningsEl.innerHTML = `<strong>Account warnings</strong>${data.map((warning) => `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--warn)">
      <span>${esc(warning.reason)}</span><br>
      <small>${esc(new Date(warning.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }))}</small>
    </div>
  `).join('')}`;
  warningsEl.style.display = 'block';
}

function updateAvatarPreview(url) {
  if (url) {
    avatarImg.src = url;
    avatarImg.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
    avatarRemove.style.display = 'inline-flex';
  } else {
    avatarImg.style.display = 'none';
    avatarPlaceholder.style.display = 'block';
    avatarRemove.style.display = 'none';
  }
}

function showAvatarMsg(text, type = 'muted') {
  avatarMsg.textContent = text;
  avatarMsg.className = type === 'muted' ? 'muted' : `pill ${type}`;
}

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
  msgEl.style.display = 'block';
}

// Avatar upload
avatarInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!currentSession) return;

  showAvatarMsg('Uploading...', 'warn');
  avatarInput.disabled = true;
  avatarRemove.disabled = true;

  try {
    // Upload new avatar
    const { error, url } = await uploadAvatar(currentSession.user.id, file);
    if (error) throw error;

    // Update profile with new avatar_url
    const { error: updateError } = await updateProfile(currentSession.user.id, { avatar_url: url });
    if (updateError) {
      console.error('Avatar profile update error:', updateError.message, updateError.code, updateError);
      throw updateError;
    }

    // Delete old avatar if existed
    if (currentProfile?.avatar_url && currentProfile.avatar_url !== url) {
      await deleteAvatar(currentSession.user.id, currentProfile.avatar_url);
    }

    // Update local state and UI
    currentProfile = { ...currentProfile, avatar_url: url };
    updateAvatarPreview(url);

    // Update cache and nav immediately
    sessionStorage.setItem('palitrento_profile_cache', JSON.stringify({
      data: currentProfile,
      timestamp: Date.now(),
      userId: currentSession.user.id
    }));
    renderChrome('/account/', currentSession, getAccountDisplayProfile(currentProfile));

    showAvatarMsg('Photo updated', 'ok');
  } catch (err) {
    console.error('Avatar upload error:', err);
    showAvatarMsg('Upload failed. Please try again.', 'bad');
  } finally {
    avatarInput.disabled = false;
    avatarRemove.disabled = false;
    avatarInput.value = ''; // reset so same file can be re-selected
  }
});

// Remove avatar
avatarRemove.addEventListener('click', async () => {
  if (!currentSession || !currentProfile?.avatar_url) return;

  const confirmed = confirm('Remove your profile photo?');
  if (!confirmed) return;

  showAvatarMsg('Removing...', 'warn');
  avatarRemove.disabled = true;
  avatarInput.disabled = true;

  try {
    await deleteAvatar(currentSession.user.id, currentProfile.avatar_url);

    const { error } = await updateProfile(currentSession.user.id, { avatar_url: null });
    if (error) {
      console.error('Avatar remove profile update error:', error.message, error.code, error);
      throw error;
    }

    currentProfile = { ...currentProfile, avatar_url: null };
    updateAvatarPreview(null);

    // Update cache and nav
    sessionStorage.setItem('palitrento_profile_cache', JSON.stringify({
      data: currentProfile,
      timestamp: Date.now(),
      userId: currentSession.user.id
    }));
    renderChrome('/account/', currentSession, getAccountDisplayProfile(currentProfile));

    showAvatarMsg('Photo removed', 'ok');
  } catch (err) {
    console.error('Avatar remove error:', err);
    showAvatarMsg('Failed to remove. Please try again.', 'bad');
  } finally {
    avatarRemove.disabled = false;
    avatarInput.disabled = false;
  }
});

// Save profile (name, barangay)
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.style.display = 'none';

  if (!supabase || !currentSession) {
    showMsg('Login is not available right now.', 'bad');
    return;
  }

  const fullName = form.full_name.value.trim();
  const barangay = form.barangay.value;

  if (!fullName) {
    showMsg('Please enter your full name', 'bad');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const { error } = await updateProfile(currentSession.user.id, {
      full_name: fullName,
      barangay: barangay || null
    });

    if (error) {
      console.error('Profile update error:', error.message, error.code);
      showMsg('Failed to save. Please try again.', 'bad');
      return;
    }

    // Update local profile and cache
    currentProfile = { ...currentProfile, full_name: fullName, barangay: barangay || null };
    sessionStorage.setItem('palitrento_profile_cache', JSON.stringify({
      data: currentProfile,
      timestamp: Date.now(),
      userId: currentSession.user.id
    }));

    showMsg('Saved', 'ok');
    renderChrome('/account/', currentSession, getAccountDisplayProfile(currentProfile));
  } catch (err) {
    console.error('Profile update exception:', err);
    showMsg('Something went wrong. Please try again.', 'bad');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save changes';
  }
});

$('#logout-btn').addEventListener('click', async () => {
  const btn = $('#logout-btn');
  btn.disabled = true;
  btn.textContent = 'Logging out...';

  const { error } = await signOut();
  if (error) {
    showMsg('Failed to log out. Please try again.', 'bad');
    btn.disabled = false;
    btn.textContent = 'Log out';
    return;
  }

  clearProfileCache();
  window.location.href = '/';
});

onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    clearProfileCache();
    window.location.href = '/login/';
  }
});

function $$ (s, r = document) { return r.querySelectorAll(s); }

// ===== Subscription Functions =====

async function loadSubscriptionData(userId) {
  if (!supabase) return;

  try {
    const { data, error } = await supabase.rpc('get_subscription_dashboard_data', { p_user_id: userId });
    if (error) throw error;

    renderSubscriptionData(data);

    // Update profile cache with premium status for quick access
    const isPremium = data?.subscription?.is_premium === true && data?.subscription?.status === 'ACTIVE';
    const { getCachedProfile } = await import('./auth.js');
    const profile = await getCachedProfile(userId);
    if (profile) {
      const updatedProfile = { ...profile, is_premium: isPremium, premium_details: data?.subscription ?? null };
      sessionStorage.setItem('palitrento_profile_cache', JSON.stringify({
        data: updatedProfile,
        timestamp: Date.now(),
        userId
      }));
    }

    // Update premium indicator in nav
    const { getSession } = await import('./auth.js');
    const session = await getSession();
    if (session) {
      const freshProfile = await getCachedProfile(session.user.id);
      updatePremiumIndicator(session, freshProfile);
    }
  } catch (err) {
    console.error('Load subscription data error:', err);
    // Default to Free Plan
    renderSubscriptionData({ subscription: null, plan_details: { code: 'FREE', name: 'Free Plan', price_monthly_cents: 0, free_listing_quota: 15, featured_promo_price_cents: 1000, priority_search_boost: 0, visual_badge: 'FREE' }, entitlement: { free_listings_used: 0, paid_listings_count: 0, total_listings_allowed: 15, remaining_free: 15 } });
  }
}

function renderSubscriptionData(data) {
  const { subscription, plan_details, entitlement, locks, featured_promotions, stores } = data;

  // Show/hide plan status sections
  const premiumStatus = $('#sub-premium-status');
  const freeStatus = $('#sub-free-status');
  const expiredStatus = $('#sub-expired-status');
  const graceStatus = $('#sub-grace-status');
  const planBadge = $('#sub-plan-badge');
  const planName = $('#sub-plan-name');
  const planDescription = $('#sub-plan-description');

  // Reset all
  [premiumStatus, freeStatus, expiredStatus, graceStatus].forEach(el => el.style.display = 'none');
  $('#subscription-plan-card').classList.remove('premium-active-plan-card');
  setPremiumShader(false);

  if (subscription) {
    const isPremium = subscription.is_premium;
    const status = subscription.status;

    if (status === 'ACTIVE' && isPremium) {
      // Premium Active
      premiumStatus.style.display = 'block';
      $('#subscription-plan-card').classList.add('premium-active-plan-card');
      setPremiumShader(true);
      setPlanBadge(planBadge, '✦ Premium', 'pill ok', true);
      planName.textContent = 'Premium Plan';
      planDescription.textContent = 'Your membership, renewal, and perks at a glance.';
      $('#sub-renewal-date').textContent = new Date(subscription.current_period_end).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
      $('#sub-grace-warning').style.display = 'none';
    } else if (status === 'ACTIVE' && !isPremium) {
      // Free Plan
      freeStatus.style.display = 'grid';
      setPlanBadge(planBadge, 'Free', 'pill free-plan-badge');
      planName.textContent = 'Free Plan';
      planDescription.textContent = '15 free listings, then ₱1 per additional listing.';
      renderFreePlanUsage(entitlement, plan_details);
    } else if (status === 'PAST_DUE') {
      // Grace Period
      graceStatus.style.display = 'block';
      setPlanBadge(planBadge, 'Grace Period', 'pill warn');
      planName.textContent = 'Premium Plan (Grace Period)';
      planDescription.textContent = 'Your subscription has expired. You have 5 days to renew.';
      const graceEnd = new Date(subscription.grace_period_ends_at);
      const daysLeft = Math.ceil((graceEnd - Date.now()) / (1000 * 60 * 60 * 24));
      $('#sub-grace-days').textContent = Math.max(0, daysLeft);
      $('#sub-grace-end').textContent = graceEnd.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    } else if (status === 'EXPIRED' || status === 'CANCELLED') {
      // Expired
      expiredStatus.style.display = 'block';
      setPlanBadge(planBadge, 'Expired', 'pill bad');
      planName.textContent = isPremium ? 'Premium Plan (Expired)' : 'Free Plan';
      planDescription.textContent = 'Your subscription has expired. Products are locked.';
    }
  } else {
    // No subscription - Free Plan default
    freeStatus.style.display = 'grid';
    setPlanBadge(planBadge, 'Free', 'pill free-plan-badge');
    planName.textContent = 'Free Plan';
    planDescription.textContent = '15 free listings, then ₱1 per additional listing.';
    renderFreePlanUsage(entitlement, plan_details);
  }

  // Bind upgrade/renew buttons
  bindSubscriptionButtons();
}

function bindSubscriptionButtons() {
  // Upgrade to Premium
  $('#sub-upgrade-btn')?.addEventListener('click', () => {
    window.location.href = '/dashboard/?upgrade=1#tab-subscription';
  });

  $('#sub-featured-promo-btn')?.addEventListener('click', () => {
    window.location.href = '/dashboard/#tab-subscription';
  });

  // Renew during grace period
  $('#sub-renew-grace-btn')?.addEventListener('click', () => {
    window.location.href = '/dashboard/?upgrade=1#tab-subscription';
  });

  // Renew after expiry
  $('#sub-renew-btn')?.addEventListener('click', () => {
    window.location.href = '/dashboard/?upgrade=1#tab-subscription';
  });

  // Unlock products (redirect to dashboard)
  $('#sub-unlock-products-btn')?.addEventListener('click', () => {
    window.location.href = '/dashboard/#tab-subscription';
  });

  // Manage subscription
  $('#sub-manage-btn')?.addEventListener('click', () => {
    window.location.href = '/dashboard/#tab-subscription';
  });
}

loadAccount();

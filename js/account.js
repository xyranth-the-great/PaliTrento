import { renderChrome, $, esc, BARANGAYS, peso } from './ui.js';
import { supabase } from './supabase.js';
import {
  getSession, getCachedProfile, updateProfile, uploadAvatar, deleteAvatar,
  signOut, onAuthStateChange, isSupabaseConfigured, getLoginUnavailableMessage, clearProfileCache
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

let currentProfile = null;
let currentSession = null;
let currentOrders = [];

async function loadAccount() {
  if (!isSupabaseConfigured()) {
    showMsg(getLoginUnavailableMessage(), 'warn');
    return;
  }

  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  currentSession = session;

  // Check for tab parameter
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'profile';

  // Update nav with session and cached profile
  const cachedProfile = await getCachedProfile(session.user.id);
  renderChrome('account.html', session, cachedProfile);

  // Fetch fresh profile for the form
  const profile = await getCachedProfile(session.user.id);
  currentProfile = profile;

  // Set active tab
  $$('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === initialTab;
    btn.setAttribute('aria-selected', isActive);
  });
  $$('[role="tabpanel"]').forEach(p => {
    p.style.display = p.id === `tab-${initialTab}` ? 'block' : 'none';
  });

  // Populate barangay dropdown
  const brgySelect = $('#acc-barangay');
  brgySelect.innerHTML = '<option value="">Choose your barangay</option>' +
    BARANGAYS.map(b => `<option value="${esc(b)}"${profile?.barangay === b ? ' selected' : ''}>${esc(b)}</option>`).join('');

  // Fill form fields
  $('#acc-name').value = profile?.full_name ?? session.user.user_metadata?.full_name ?? '';
  $('#acc-email').value = profile?.email ?? session.user.email ?? '';
  const role = profile?.role ?? session.user.user_metadata?.role ?? 'customer';
  $('#acc-role').value = role.replace('_', ' ');
  $('#account-role-badge').textContent = role.replace('_', ' ');
  if (profile?.barangay) brgySelect.value = profile.barangay;

  // Show avatar
  updateAvatarPreview(profile?.avatar_url ?? null);

  // Load orders
  await loadOrders();

  contentEl.style.display = 'block';
}

async function loadOrders() {
  try {
    // Load orders with products and stores
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        products (name, unit, current_price),
        stores (business_name, trn_code, barangay)
      `)
      .eq('buyer_id', currentSession.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('Customer orders loaded:', orders?.length);
    currentOrders = orders || [];
    renderOrders();
  } catch (err) {
    console.error('Load orders error:', err);
  }
}

function renderOrders() {
  const container = $('#orders-history');
  if (!container) return;

  if (currentOrders.length === 0) {
    container.innerHTML = '<p class="muted" style="text-align:center;padding:24px">No orders yet. <a href="products.html">Start shopping</a></p>';
    return;
  }

  const statusColors = {
    PENDING: 'warn',
    CONFIRMED: 'info',
    READY_FOR_PICKUP: 'ok',
    COMPLETED: 'ok',
    CANCELLED: 'bad'
  };
  const statusLabels = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    READY_FOR_PICKUP: 'Ready for pickup',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
  };

  container.innerHTML = currentOrders.map(o => {
    const product = o.products;
    const store = o.stores;
    const color = statusColors[o.status] || 'warn';
    const label = statusLabels[o.status] || o.status;

    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0 0 4px;font-size:1rem">${esc(product?.name || 'Product')}</h3>
            <p class="muted" style="margin:0;font-size:.85rem">${esc(store?.business_name || 'Store')} • ${esc(store?.barangay || '')}</p>
            <p class="muted" style="margin:4px 0 0;font-size:.8rem">${o.quantity} × ${peso(product?.current_price || 0)} = <strong>${peso(o.total_price)}</strong></p>
          </div>
          <span class="pill ${color}" style="font-size:.75rem;white-space:nowrap">${label}</span>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <a href="chat.html?orderId=${o.id}" class="btn alt" style="padding:6px 12px;font-size:.8rem;text-decoration:none">Chat</a>
        </div>
        <p class="muted" style="margin:8px 0 0;font-size:.75rem">Ordered: ${new Date(o.created_at).toLocaleString('en-PH')}</p>
        ${o.notes ? `<p class="muted" style="margin:8px 0 0;font-size:.8rem">Notes: ${esc(o.notes)}</p>` : ''}
      </div>
    `;
  }).join('');
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
    renderChrome('account.html', currentSession, currentProfile);

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
    renderChrome('account.html', currentSession, currentProfile);

    showAvatarMsg('Photo removed', 'ok');
  } catch (err) {
    console.error('Avatar remove error:', err);
    showAvatarMsg('Failed to remove. Please try again.', 'bad');
  } finally {
    avatarRemove.disabled = false;
    avatarInput.disabled = false;
  }
});

// Tab switching
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b => b.setAttribute('aria-selected', 'false'));
    btn.setAttribute('aria-selected', 'true');
    $$('[role="tabpanel"]').forEach(p => p.style.display = 'none');
    $(`#tab-${btn.dataset.tab}`).style.display = 'block';
  });
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
    renderChrome('account.html', currentSession, currentProfile);
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
  window.location.href = 'index.html';
});

onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    clearProfileCache();
    window.location.href = 'login.html';
  }
});

function $$ (s, r = document) { return r.querySelectorAll(s); }

loadAccount();
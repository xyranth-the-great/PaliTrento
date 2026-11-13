import { renderChrome, $, esc, BARANGAYS, peso } from './ui.js';
import { supabase } from './supabase.js';
import {
  getSession, getCachedProfile, updateProfile, uploadAvatar, deleteAvatar,
  signOut, onAuthStateChange, isSupabaseConfigured, getLoginUnavailableMessage, clearProfileCache
} from './auth.js';

const contentEl = $('#settings-content');
const msgEl = $('#settings-message');
let currentProfile = null;
let currentSession = null;
let accountDeletionInProgress = false;

// ===== Tab Navigation =====
const tabBtns = $$('.settings-tabs .settings-tab-btn');
const tabPanels = $$('[role="tabpanel"]');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
  });

  btn.addEventListener('keydown', (event) => {
    const index = Array.from(tabBtns).indexOf(btn);
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabBtns.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabBtns.length) % tabBtns.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabBtns.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    switchTab(tabBtns[nextIndex].dataset.tab, true);
  });
});

function switchTab(tab, moveFocus = false) {
  tabBtns.forEach(b => {
    const isActive = b.dataset.tab === tab;
    b.setAttribute('aria-selected', isActive);
    b.tabIndex = isActive ? 0 : -1;
  });
  tabPanels.forEach(p => {
    p.style.display = p.id === `tab-${tab}` ? 'block' : 'none';
  });
  if (moveFocus) Array.from(tabBtns).find(b => b.dataset.tab === tab)?.focus();
  window.scrollTo(0, 0);
}

// ===== Load Settings =====
async function loadSettings() {
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
  currentProfile = await getCachedProfile(session.user.id);
  renderChrome('settings.html', session, currentProfile);

  // Populate barangay dropdown
  const brgySelect = $('#set-barangay');
  brgySelect.innerHTML = '<option value="">Choose your barangay</option>' +
    BARANGAYS.map(b => `<option value="${esc(b)}"${currentProfile?.barangay === b ? ' selected' : ''}>${esc(b)}</option>`).join('');

  // Fill profile form
  $('#set-name').value = currentProfile?.full_name ?? session.user.user_metadata?.full_name ?? '';
  $('#set-email').value = session.user.email ?? '';
  const role = currentProfile?.role ?? session.user.user_metadata?.role ?? 'customer';
  $('#set-role').value = role.replace('_', ' ');

  // Load avatar
  updateAvatarPreview(currentProfile?.avatar_url ?? null);

  // Load saved preferences from localStorage
  loadPreferences();

  contentEl.style.display = 'block';
}

function updateAvatarPreview(url) {
  const avatarPreview = $('#avatar-preview');
  const avatarImg = $('#avatar-img');
  const avatarPlaceholder = $('#avatar-placeholder');
  const avatarRemove = $('#avatar-remove');
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

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
  msgEl.style.display = 'block';
}

function showAvatarMsg(text, type = 'muted') {
  const avatarMsg = $('#avatar-msg');
  avatarMsg.textContent = text;
  avatarMsg.className = type === 'muted' ? 'muted' : `pill ${type}`;
}

// ===== Avatar Upload =====
$('#avatar-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!currentSession) return;

  showAvatarMsg('Uploading...', 'warn');
  $('#avatar-input').disabled = true;
  $('#avatar-remove').disabled = true;

  try {
    const { error, url } = await uploadAvatar(currentSession.user.id, file);
    if (error) throw error;

    const { error: updateError } = await updateProfile(currentSession.user.id, { avatar_url: url });
    if (updateError) throw updateError;

    if (currentProfile?.avatar_url && currentProfile.avatar_url !== url) {
      await deleteAvatar(currentSession.user.id, currentProfile.avatar_url);
    }

    currentProfile = { ...currentProfile, avatar_url: url };
    updateAvatarPreview(url);

    sessionStorage.setItem('palitrento_profile_cache', JSON.stringify({
      data: currentProfile,
      timestamp: Date.now(),
      userId: currentSession.user.id
    }));
    renderChrome('settings.html', currentSession, currentProfile);

    showAvatarMsg('Photo updated', 'ok');
  } catch (err) {
    console.error('Avatar upload error:', err);
    showAvatarMsg('Upload failed. Please try again.', 'bad');
  } finally {
    $('#avatar-input').disabled = false;
    $('#avatar-remove').disabled = false;
    $('#avatar-input').value = '';
  }
});

// Remove avatar
$('#avatar-remove').addEventListener('click', async () => {
  if (!currentSession || !currentProfile?.avatar_url) return;

  const confirmed = confirm('Remove your profile photo?');
  if (!confirmed) return;

  showAvatarMsg('Removing...', 'warn');
  $('#avatar-remove').disabled = true;
  $('#avatar-input').disabled = true;

  try {
    await deleteAvatar(currentSession.user.id, currentProfile.avatar_url);
    const { error } = await updateProfile(currentSession.user.id, { avatar_url: null });
    if (error) throw error;

    currentProfile = { ...currentProfile, avatar_url: null };
    updateAvatarPreview(null);

    sessionStorage.setItem('palitrento_profile_cache', JSON.stringify({
      data: currentProfile,
      timestamp: Date.now(),
      userId: currentSession.user.id
    }));
    renderChrome('settings.html', currentSession, currentProfile);

    showAvatarMsg('Photo removed', 'ok');
  } catch (err) {
    console.error('Avatar remove error:', err);
    showAvatarMsg('Failed to remove. Please try again.', 'bad');
  } finally {
    $('#avatar-remove').disabled = false;
    $('#avatar-input').disabled = false;
  }
});

// ===== Save Profile =====
$('#profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.style.display = 'none';

  if (!supabase || !currentSession) {
    showMsg('Login is not available right now.', 'bad');
    return;
  }

  const fullName = $('#set-name').value.trim();
  const barangay = $('#set-barangay').value;

  if (!fullName) {
    showMsg('Please enter your full name', 'bad');
    return;
  }

  const saveBtn = $('#save-profile-btn');
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

    currentProfile = { ...currentProfile, full_name: fullName, barangay: barangay || null };
    sessionStorage.setItem('palitrento_profile_cache', JSON.stringify({
      data: currentProfile,
      timestamp: Date.now(),
      userId: currentSession.user.id
    }));

    showMsg('Profile saved', 'ok');
    renderChrome('settings.html', currentSession, currentProfile);
  } catch (err) {
    console.error('Profile update exception:', err);
    showMsg('Something went wrong. Please try again.', 'bad');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save profile';
  }
});

// ===== Notifications =====
const NOTIF_KEY = 'palitrento_notifications';
const DEFAULT_NOTIFS = {
  orders: true,
  messages: true,
  price_caps: false,
  store_announcements: false,
  digest: false,
  push: false
};

function loadPreferences() {
  // Notifications
  try {
    const stored = localStorage.getItem(NOTIF_KEY);
    const prefs = stored ? JSON.parse(stored) : DEFAULT_NOTIFS;
    Object.keys(DEFAULT_NOTIFS).forEach(key => {
      const el = $(`#notif-${key}`);
      if (el) el.checked = prefs[key] ?? DEFAULT_NOTIFS[key];
    });
  } catch {}

  // Privacy
  try {
    const stored = localStorage.getItem('palitrento_privacy');
    const prefs = stored ? JSON.parse(stored) : {
      show_name: true,
      show_barangay: true,
      store_contact: true,
      analytics: true,
      lgu_data: false
    };
    Object.keys(prefs).forEach(key => {
      const el = $(`#privacy-${key}`);
      if (el) el.checked = prefs[key];
    });
  } catch {}

  // Preferences
  try {
    const stored = localStorage.getItem('palitrento_preferences');
    const prefs = stored ? JSON.parse(stored) : {
      language: 'en',
      currency: 'PHP',
      theme: 'system',
      autoplay: false,
      reduce_motion: false
    };
    $('#pref-language').value = prefs.language;
    $('#pref-currency').value = prefs.currency;
    $('#pref-theme').value = prefs.theme;
    $('#pref-autoplay').checked = prefs.autoplay;
    $('#pref-reduce-motion').checked = prefs.reduce_motion;
    applyTheme(prefs.theme);
  } catch {}
}

function saveNotifications() {
  const prefs = {
    orders: $('#notif-orders').checked,
    messages: $('#notif-messages').checked,
    price_caps: $('#notif-price-caps').checked,
    store_announcements: $('#notif-store-announcements').checked,
    digest: $('#notif-digest').checked,
    push: $('#notif-push').checked
  };
  localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
  showMsg('Notification preferences saved', 'ok');
}

$('#save-notif-btn').addEventListener('click', saveNotifications);

// ===== Privacy =====
function savePrivacy() {
  const prefs = {
    show_name: $('#privacy-show-name').checked,
    show_barangay: $('#privacy-show-barangay').checked,
    store_contact: $('#privacy-store-contact').checked,
    analytics: $('#privacy-analytics').checked,
    lgu_data: $('#privacy-lgu-data').checked
  };
  localStorage.setItem('palitrento_privacy', JSON.stringify(prefs));
  showMsg('Privacy settings saved', 'ok');
}

$('#save-privacy-btn').addEventListener('click', savePrivacy);

// ===== Preferences =====
function savePreferences() {
  const prefs = {
    language: $('#pref-language').value,
    currency: $('#pref-currency').value,
    theme: $('#pref-theme').value,
    autoplay: $('#pref-autoplay').checked,
    reduce_motion: $('#pref-reduce-motion').checked
  };
  localStorage.setItem('palitrento_preferences', JSON.stringify(prefs));
  applyTheme(prefs.theme);
  showMsg('Preferences saved', 'ok');
}

function applyTheme(theme) {
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

$('#save-preferences-btn').addEventListener('click', savePreferences);

// ===== Security: Change Password =====
const securityMsg = $('#security-msg');
$('#save-password-btn').addEventListener('click', async () => {
  securityMsg.style.display = 'none';
  const current = $('#set-current-password').value;
  const newPass = $('#set-new-password').value;
  const confirm = $('#set-confirm-password').value;

  if (!current || !newPass || !confirm) {
    securityMsg.textContent = 'Please fill in all fields';
    securityMsg.className = 'pill bad';
    securityMsg.style.display = 'block';
    return;
  }
  if (newPass !== confirm) {
    securityMsg.textContent = 'New passwords do not match';
    securityMsg.className = 'pill bad';
    securityMsg.style.display = 'block';
    return;
  }
  if (newPass.length < 8) {
    securityMsg.textContent = 'Password must be at least 8 characters';
    securityMsg.className = 'pill bad';
    securityMsg.style.display = 'block';
    return;
  }

  if (!supabase || !currentSession) {
    securityMsg.textContent = 'Login is not available right now';
    securityMsg.className = 'pill bad';
    securityMsg.style.display = 'block';
    return;
  }

  const btn = $('#save-password-btn');
  btn.disabled = true;
  btn.textContent = 'Changing...';

  try {
    // Verify current password by trying to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentSession.user.email,
      password: current
    });
    if (signInError) throw new Error('Current password is incorrect');

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPass
    });
    if (updateError) throw updateError;

    securityMsg.textContent = 'Password changed successfully';
    securityMsg.className = 'pill ok';
    securityMsg.style.display = 'block';
    $('#set-current-password').value = '';
    $('#set-new-password').value = '';
    $('#set-confirm-password').value = '';
  } catch (err) {
    console.error('Password change error:', err);
    securityMsg.textContent = err.message || 'Failed to change password';
    securityMsg.className = 'pill bad';
    securityMsg.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Change password';
  }
});

// ===== Active Sessions =====
async function loadSessions() {
  const listEl = $('#sessions-list');
  if (!supabase || !currentSession) {
    listEl.innerHTML = '<p class="muted">Unable to load sessions</p>';
    return;
  }

  try {
    // Get sessions from Supabase (requires service role, so we'll show current session only)
    listEl.innerHTML = `
      <div class="session-item" style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);margin-bottom:8px">
        <div>
          <strong>Current session</strong>
          <div class="muted" style="font-size:.85rem">This device • Active now</div>
        </div>
        <span class="pill ok">Current</span>
      </div>
      <p class="muted" style="font-size:.85rem">Note: Only the current session is shown. Use "Log out of all other devices" to revoke all sessions.</p>
    `;
  } catch {
    listEl.innerHTML = '<p class="muted">Failed to load sessions</p>';
  }
}

loadSessions();

$('#revoke-all-btn').addEventListener('click', async () => {
  if (!confirm('Log out of all devices except this one? You will need to log in again on other devices.')) return;
  if (!supabase) return;

  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) throw error;
    clearProfileCache();
    window.location.href = 'login.html';
  } catch (err) {
    console.error('Global sign out error:', err);
    alert('Failed to revoke sessions. Please try again.');
  }
});

// ===== Export/Download Data =====
$('#export-data-btn').addEventListener('click', async () => {
  if (!supabase || !currentSession) return alert('Not available');
  try {
    // Fetch user data
    const [profileRes, ordersRes, messagesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', currentSession.user.id).single(),
      supabase.from('orders').select('*').or(`buyer_id.eq.${currentSession.user.id},store_id.in.(select id from stores where user_id=eq.${currentSession.user.id})`),
      supabase.from('messages').select('*').in('order_id', (await supabase.from('orders').select('id').or(`buyer_id.eq.${currentSession.user.id},store_id.in.(select id from stores where user_id=eq.${currentSession.user.id})`)).data?.map(o => o.id) || [])
    ]);

    const data = {
      profile: profileRes.data,
      orders: ordersRes.data,
      messages: messagesRes.data,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `palitrento-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export error:', err);
    alert('Failed to export data');
  }
});

$('#download-data-btn').addEventListener('click', async () => {
  if (!supabase || !currentSession) return alert('Not available');
  try {
    // Get user's order IDs
    const { data: stores } = await supabase.from('stores').select('id').eq('user_id', currentSession.user.id);
    const storeIds = (stores || []).map(s => s.id);
    let query = supabase.from('orders').select('id').eq('buyer_id', currentSession.user.id);
    if (storeIds.length > 0) {
      query = query.or(`buyer_id.eq.${currentSession.user.id},store_id.in.(${storeIds.join(',')})`);
    }
    const { data: orders } = await query;
    const orderIds = (orders || []).map(o => o.id);

    const { data: messages } = await supabase.from('messages').select('*').in('order_id', orderIds);

    const data = {
      chatHistory: messages,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `palitrento-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download chat error:', err);
    alert('Failed to download chat history');
  }
});

// ===== Danger Zone: Delete Account =====
$('#confirm-delete').addEventListener('change', (e) => {
  $('#delete-account-btn').disabled = !e.target.checked;
});

$('#delete-account-btn').addEventListener('click', async () => {
  if (!confirm('FINAL WARNING: This will permanently delete your account and ALL data. Type "DELETE" to confirm.')) return;
  const input = prompt('Type DELETE to confirm:');
  if (input !== 'DELETE') return alert('Cancelled - confirmation text did not match');

  if (!supabase || !currentSession) return alert('Not available');

  try {
    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { confirmation: 'DELETE' },
    });
    if (error) throw error;
    if (data?.success !== true) throw new Error(data?.error || 'Account deletion failed');

    accountDeletionInProgress = true;
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) console.error('Local sign out after account deletion failed:', signOutError);
    clearProfileCache();

    alert('Your account and data have been permanently deleted.');
    window.location.replace('index.html');
  } catch (err) {
    console.error('Delete account error:', err);
    alert('Failed to delete account. Please contact support.');
  }
});

// ===== Danger Zone: Delete Store =====
$('#confirm-delete-store').addEventListener('change', (e) => {
  $('#delete-store-btn').disabled = !e.target.checked;
});

$('#delete-store-btn').addEventListener('click', async () => {
  if (!confirm('This will permanently delete your store and all products. Orders and chat history for buyers will remain. Type "DELETE STORE" to confirm.')) return;
  const input = prompt('Type DELETE STORE to confirm:');
  if (input !== 'DELETE STORE') return alert('Cancelled - confirmation text did not match');

  if (!supabase || !currentSession) return alert('Not available');

  try {
    // Get user's store
    const { data: stores } = await supabase.from('stores').select('id').eq('user_id', currentSession.user.id);
    if (!stores || stores.length === 0) return alert('No store found for your account');

    const storeId = stores[0].id;

    // Delete store images
    const { data: storeImages } = await supabase.storage.from('store-images').list(currentSession.user.id);
    if (storeImages?.length) {
      await supabase.storage.from('store-images').remove(storeImages.map(f => `${currentSession.user.id}/${f.name}`));
    }

    // Delete product images
    const { data: productImages } = await supabase.storage.from('product-images').list(currentSession.user.id);
    if (productImages?.length) {
      await supabase.storage.from('product-images').remove(productImages.map(f => `${currentSession.user.id}/${f.name}`));
    }

    // Delete products
    await supabase.from('products').delete().eq('store_id', storeId);

    // Delete store
    await supabase.from('stores').delete().eq('id', storeId);

    // Update profile role to customer if they had no other stores
    const { data: otherStores } = await supabase.from('stores').select('id').eq('user_id', currentSession.user.id);
    if (!otherStores || otherStores.length === 0) {
      await updateProfile(currentSession.user.id, { role: 'customer' });
      currentProfile = { ...currentProfile, role: 'customer' };
      sessionStorage.setItem('palitrento_profile_cache', JSON.stringify({
        data: currentProfile,
        timestamp: Date.now(),
        userId: currentSession.user.id
      }));
      renderChrome('settings.html', currentSession, currentProfile);
    }

    alert('Store deleted successfully');
    window.location.href = 'account.html';
  } catch (err) {
    console.error('Delete store error:', err);
    alert('Failed to delete store. Please contact support.');
  }
});

// ===== Auth State Change =====
onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    clearProfileCache();
    if (!accountDeletionInProgress) window.location.href = 'login.html';
  }
});

// Helper
function $$ (s, r = document) { return r.querySelectorAll(s); }

// Initialize
loadSettings();
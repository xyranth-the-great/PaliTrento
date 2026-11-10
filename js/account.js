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

  const profile = await getCachedProfile(session.user.id);
  renderChrome('account.html', session, profile);

  // Fetch fresh profile for the form
  currentProfile = await getCachedProfile(session.user.id);

  // Populate barangay dropdown
  const brgySelect = $('#acc-barangay');
  brgySelect.innerHTML = '<option value="">Choose your barangay</option>' +
    BARANGAYS.map(b => `<option value="${esc(b)}"${currentProfile?.barangay === b ? ' selected' : ''}>${esc(b)}</option>`).join('');

  // Fill form fields
  $('#acc-name').value = currentProfile?.full_name ?? session.user.user_metadata?.full_name ?? '';
  $('#acc-email').value = currentProfile?.email ?? session.user.email ?? '';
  const role = currentProfile?.role ?? session.user.user_metadata?.role ?? 'customer';
  $('#acc-role').value = role.replace('_', ' ');
  $('#account-role-badge').textContent = role.replace('_', ' ');
  if (currentProfile?.barangay) brgySelect.value = currentProfile.barangay;

  // Show avatar
  updateAvatarPreview(currentProfile?.avatar_url ?? null);

  contentEl.style.display = 'block';
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
import { renderChrome, $, esc, BARANGAYS, peso, startAdvisoryToastListener, checkPasswordStrength, createPasswordStrengthIndicator, initPasswordStrength } from './ui.js';
import { supabase } from './supabase.js';
import {
  getSessionWithStatus, getCachedProfile, updateProfile, uploadAvatar, deleteAvatar,
  signOut, onAuthStateChange, isSupabaseConfigured, getLoginUnavailableMessage, clearProfileCache, checkAuthErrorParams
} from './auth.js';
import { subscribeToPush, unsubscribeFromPush, updatePushUI, requestNotificationPermission } from './push.js';

const contentEl = $('#settings-content');
const msgEl = $('#settings-message');
let currentProfile = null;
let currentSession = null;
let accountDeletionInProgress = false;
let passwordSetupRequired = false;

document.querySelectorAll('.password-visibility-toggle').forEach(button => {
  const input = document.getElementById(button.dataset.passwordTarget);
  if (!input) return;
  const label = input.labels?.[0]?.textContent.trim() || 'password';
  button.setAttribute('aria-label', `Show ${label}`);
  button.addEventListener('click', () => {
    const isVisible = input.type === 'text';
    const selStart = input.selectionStart, selEnd = input.selectionEnd;
    input.type = isVisible ? 'password' : 'text';
    button.setAttribute('aria-pressed', String(!isVisible));
    button.setAttribute('aria-label', `${isVisible ? 'Show' : 'Hide'} ${label}`);
    input.focus();
    try { input.setSelectionRange(selStart, selEnd); } catch (e) {}
  });
});

function configurePasswordForm() {
  const isGoogleAccount = currentSession?.user?.app_metadata?.provider === 'google';
  passwordSetupRequired = isGoogleAccount
    && currentSession.user.user_metadata?.password_setup_completed !== true;

  $('#current-password-field').hidden = passwordSetupRequired;
  $('#password-form-description').textContent = passwordSetupRequired
    ? 'Add a password so you can also sign in with your email and password. Google sign-in will keep working.'
    : 'Manage your password and login security.';
  $('#new-password-label').textContent = passwordSetupRequired ? 'Create password' : 'New password';
  $('#confirm-password-label').textContent = passwordSetupRequired ? 'Confirm password' : 'Confirm new password';
  $('#save-password-btn').textContent = passwordSetupRequired ? 'Set password' : 'Change password';
}

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

  // Initialize password strength indicator when security tab is shown
  if (tab === 'security') {
    const pwContainer = $('#password-strength-container');
    if (pwContainer && !pwContainer.querySelector('.password-strength')) {
      pwContainer.innerHTML = createPasswordStrengthIndicator('set-new-password');
      initPasswordStrength('set-new-password', { showRequirements: true });
    }
  }
}

// ===== Load Settings =====
async function loadSettings() {
  if (!isSupabaseConfigured()) {
    showMsg(getLoginUnavailableMessage()), 'warn';
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
  configurePasswordForm();
  currentProfile = profile || await getCachedProfile(session.user.id);
  configureDangerZoneForRole();
  renderChrome('/settings/', session, currentProfile);

  // Start advisory toast listener
  startAdvisoryToastListener();

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

  // Load notification preferences from database (with localStorage fallback)
  await loadNotificationPreferences(session.user.id);

  // Load saved privacy preferences from localStorage
  loadPrivacyPreferences();

  // Initialize push notification UI
  updatePushUI();

  contentEl.style.display = 'block';
}

async function loadNotificationPreferences(userId) {
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('orders, messages, price_caps, store_announcements, push')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // Fallback to localStorage
      loadPreferences();
      return;
    }

    // Update UI with database values
    $('#notif-orders').checked = data.orders ?? true;
    $('#notif-messages').checked = data.messages ?? true;
    $('#notif-price-caps').checked = data.price_caps ?? false;
    $('#notif-store-announcements').checked = data.store_announcements ?? false;
    $('#notif-push').checked = data.push ?? false;

    // Also sync to localStorage for quick access
    const prefs = {
      orders: data.orders ?? true,
      messages: data.messages ?? true,
      price_caps: data.price_caps ?? false,
      store_announcements: data.store_announcements ?? false,
      push: data.push ?? false
    };
    localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.error('Load notification preferences error:', err);
    loadPreferences(); // Fallback
  }
}

function loadPrivacyPreferences() {
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
    renderChrome('/settings/', currentSession, currentProfile);

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
    renderChrome('/settings/', currentSession, currentProfile);

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
    renderChrome('/settings/', currentSession, currentProfile);
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
  push: false
};

function loadPreferences() {
  // Privacy only (notifications loaded from database via loadNotificationPreferences)
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
}

async function saveNotifications() {
  const prefs = {
    orders: $('#notif-orders').checked,
    messages: $('#notif-messages').checked,
    price_caps: $('#notif-price-caps').checked,
    store_announcements: $('#notif-store-announcements').checked,
    push: $('#notif-push').checked
  };

  // Save to localStorage immediately for quick access
  localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));

  // Handle push notification subscription change
  const pushEnabled = prefs.push;
  const pushCheckbox = $('#notif-push');
  if (pushCheckbox) {
    pushCheckbox.disabled = true;
    if (pushEnabled) {
      subscribeToPush().then(async ({ error }) => {
        pushCheckbox.disabled = false;
        if (error) {
          pushCheckbox.checked = false;
          prefs.push = false;
          localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
          // Show user-friendly message based on error code
          let message = 'Failed to enable push notifications';
          switch (error.code) {
            case 'VAPID_NOT_CONFIGURED':
              message = 'Push notifications not configured. Contact administrator.';
              break;
            case 'PERMISSION_DENIED':
              message = 'Permission denied. Enable in browser settings.';
              break;
            case 'SUBSCRIPTION_FAILED':
              message = 'Failed to subscribe. Try again.';
              break;
            case 'SAVE_FAILED':
              message = 'Subscription created but failed to save. Try again.';
              break;
          }
          showMsg(message, 'bad');
        } else {
          // Save all prefs to database after successful push subscription
          await saveNotificationPreferencesToDb(prefs);
          showMsg('Notification preferences saved', 'ok');
        }
      });
      return;
    } else {
      unsubscribeFromPush().then(async ({ error }) => {
        pushCheckbox.disabled = false;
        if (error) {
          pushCheckbox.checked = true;
          prefs.push = true;
          localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
          // Show user-friendly message based on error code
          let message = 'Failed to disable push notifications';
          switch (error.code) {
            case 'DELETE_FAILED':
              message = 'Subscription removed but failed to update server. Try again.';
              break;
            case 'UNSUBSCRIBE_FAILED':
              message = 'Failed to unsubscribe. Try again.';
              break;
            case 'SUBSCRIPTION_NOT_FOUND':
              message = 'Subscription not found. Already removed.';
              break;
          }
          showMsg(message, 'bad');
        } else {
          // Save all prefs to database after successful push unsubscription
          await saveNotificationPreferencesToDb(prefs);
          showMsg('Notification preferences saved', 'ok');
        }
      });
      return;
    }
  }

  // Save to database for non-push changes
  await saveNotificationPreferencesToDb(prefs);
  showMsg('Notification preferences saved', 'ok');
}

async function saveNotificationPreferencesToDb(prefs) {
  if (!supabase || !currentSession) return;

  try {
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        id: currentSession.user.id,
        orders: prefs.orders,
        messages: prefs.messages,
        price_caps: prefs.price_caps,
        store_announcements: prefs.store_announcements,
        push: prefs.push,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.error('Save notification preferences error:', error);
    }
  } catch (err) {
    console.error('Save notification preferences exception:', err);
  }
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

// ===== Security: Change Password =====
const securityMsg = $('#security-msg');
$('#save-password-btn').addEventListener('click', async () => {
  securityMsg.style.display = 'none';
  const current = $('#set-current-password').value;
  const newPass = $('#set-new-password').value;
  const confirm = $('#set-confirm-password').value;

  if ((!passwordSetupRequired && !current) || !newPass || !confirm) {
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

  // Use shared password validation
  const pwdResult = checkPasswordStrength(newPass);
  if (!pwdResult.valid) {
    securityMsg.textContent = 'Password must include: ' + pwdResult.errors.join(', ');
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
  btn.textContent = passwordSetupRequired ? 'Setting up...' : 'Changing...';

  try {
    if (!passwordSetupRequired) {
      // Verify the current password before replacing it.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentSession.user.email,
        password: current
      });
      if (signInError) throw new Error('Current password is incorrect');
    }

    const update = { password: newPass };
    if (passwordSetupRequired) {
      update.data = {
        ...currentSession.user.user_metadata,
        password_setup_completed: true
      };
    }
    const { data: updatedUser, error: updateError } = await supabase.auth.updateUser(update);
    if (updateError) throw updateError;

    if (updatedUser?.user) currentSession.user = updatedUser.user;
    const wasPasswordSetup = passwordSetupRequired;
    if (wasPasswordSetup) configurePasswordForm();
    securityMsg.textContent = wasPasswordSetup
      ? 'Password set. You can now sign in with Google or with your email and password.'
      : 'Password changed successfully';
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
    btn.textContent = passwordSetupRequired ? 'Set password' : 'Change password';
  }
});

// ===== Shared Helper: Get User Order IDs =====
/**
 * Fetches all order IDs for the current user (as buyer or store owner).
 * Returns an array of order IDs, or a dummy UUID array if none found
 * to avoid Supabase .in() errors with empty arrays.
 */
async function getUserOrderIds(userId) {
  if (!supabase) return [];

  try {
    // Step 1: Get store IDs owned by the user
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', userId);

    if (storesError) {
      console.error('Fetch stores error:', storesError);
      throw storesError;
    }

    const storeIds = (stores || []).map(s => s.id);

    // Step 2: Build orders query - buyer_id OR store_id.in(storeIds)
    let ordersQuery;
    if (storeIds.length > 0) {
      ordersQuery = supabase.from('orders').select('id').or(`buyer_id.eq.${userId},store_id.in.(${storeIds.join(',')})`);
    } else {
      ordersQuery = supabase.from('orders').select('id').eq('buyer_id', userId);
    }

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error('Fetch orders error:', ordersError);
      throw ordersError;
    }

    const orderIds = (orders || []).map(o => o.id);

    // Step 3: Handle empty array - return dummy UUID to avoid .in() error
    if (orderIds.length === 0) {
      return ['00000000-0000-0000-0000-000000000000'];
    }

    return orderIds;
  } catch (err) {
    console.error('getUserOrderIds error:', err);
    throw err;
  }
}

// ===== Export/Download Data (PDF) =====

// Load jsPDF and autoTable dynamically from CDN
let jsPDF = null;
async function loadPDF() {
  if (jsPDF) return { jsPDF };
  return new Promise((resolve, reject) => {
    // Load jsPDF first
    if (window.jspdf && window.jspdf.jsPDF) {
      jsPDF = window.jspdf.jsPDF;
      // autoTable will be available as doc.autoTable() after plugin loads
      return resolve({ jsPDF });
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      jsPDF = window.jspdf.jsPDF;
      // Now load autoTable plugin
      const autoTableScript = document.createElement('script');
      autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      autoTableScript.onload = () => resolve({ jsPDF });
      autoTableScript.onerror = () => reject(new Error('Failed to load jsPDF autoTable'));
      document.head.appendChild(autoTableScript);
    };
    script.onerror = () => reject(new Error('Failed to load jsPDF library'));
    document.head.appendChild(script);
  });
}

// Professional PDF export with formatting
async function exportPDF(data, filename) {
  const { jsPDF } = await loadPDF();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Color scheme
  const primaryColor = [20, 53, 31]; // #14351F - dark green
  const secondaryColor = [100, 100, 100];
  const lightGray = [248, 250, 249];
  const white = [255, 255, 255];
  const borderColor = [224, 224, 224];
  const textColor = [51, 51, 51];

  // Helper to add header/footer to each page
  let pageCount = 0;
  const totalPagesExp = '{total_pages_count_string}';

  const addHeaderFooter = (doc) => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Header
      doc.setFontSize(8);
      doc.setTextColor(...secondaryColor);
      doc.text('PaliTrento - Data Export', 14, 10);
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(0.3);
      doc.line(14, 12, 196, 12);

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(...secondaryColor);
      doc.text(`Page ${i} of ${totalPagesExp}`, 100, 285, { align: 'center' });
      doc.text(`Exported: ${data.exportedAt}`, 14, 285);
      doc.setDrawColor(...borderColor);
      doc.line(14, 282, 196, 282);
    }
  };

  // ---- Sheet 1: Profile ----
  if (data.profile) {
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Profile Information', 14, 25);

    doc.setFontSize(9);
    doc.setTextColor(...secondaryColor);
    doc.setFont('helvetica', 'normal');
    doc.text(`User: ${currentSession?.user?.email || 'Unknown'}`, 14, 31);

    const profile = data.profile;
    const fieldOrder = [
      'id', 'full_name', 'email', 'role', 'barangay', 'phone', 'avatar_url',
      'created_at', 'updated_at'
    ];
    const seen = new Set();
    const profileRows = [];

    fieldOrder.forEach(key => {
      if (profile[key] !== undefined && profile[key] !== null) {
        profileRows.push([key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), String(profile[key])]);
        seen.add(key);
      }
    });

    Object.keys(profile).forEach(key => {
      if (!seen.has(key) && profile[key] !== undefined && profile[key] !== null) {
        profileRows.push([key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), String(profile[key])]);
      }
    });

    if (profileRows.length > 0) {
      doc.autoTable({
        startY: 38,
        head: [['Field', 'Value']],
        body: profileRows,
        theme: 'striped',
        headStyles: {
          fillColor: primaryColor,
          textColor: white,
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          lineWidth: 0.2,
          lineColor: borderColor
        },
        bodyStyles: {
          fontSize: 8,
          textColor: textColor,
          lineWidth: 0.1,
          lineColor: borderColor,
          cellPadding: { top: 2, right: 3, bottom: 2, left: 3 }
        },
        alternateRowStyles: {
          fillColor: lightGray
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 'auto' }
        },
        margin: { left: 14, right: 14 },
        tableWidth: 'auto'
      });
    }
  }

  // ---- Sheet 2: Orders ----
  if (data.orders?.length) {
    const orders = data.orders.map(o => [
      o.order_number || 'N/A',
      o.status || 'N/A',
      o.total_amount !== undefined && o.total_amount !== null ? `₱${Number(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A',
      o.payment_method || 'N/A',
      o.payment_status || 'N/A',
      o.created_at ? new Date(o.created_at).toLocaleString() : 'N/A'
    ]);

    // Add new page if needed
    const currentY = doc.lastAutoTable?.finalY || 38;
    if (currentY > 220) {
      doc.addPage();
    } else if (currentY > 38) {
      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text('Orders', 14, currentY + 12);
    } else {
      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text('Orders', 14, currentY + 8);
    }

    const startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 12 : 50;

    doc.autoTable({
      startY: startY,
      head: [['Order #', 'Status', 'Total', 'Payment Method', 'Payment Status', 'Created At']],
      body: orders,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        lineWidth: 0.2,
        lineColor: borderColor
      },
      bodyStyles: {
        fontSize: 7,
        textColor: textColor,
        lineWidth: 0.1,
        lineColor: borderColor,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }
      },
      alternateRowStyles: {
        fillColor: lightGray
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 40 }
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'wrap'
    });
  }

  // ---- Sheet 3: Messages ----
  if (data.messages?.length) {
    const messages = data.messages.map(m => [
      m.order_id ? m.order_id.substring(0, 8) + '...' : 'N/A',
      m.sender_type || 'N/A',
      m.message ? (m.message.length > 50 ? m.message.substring(0, 47) + '...' : m.message) : 'N/A',
      m.type || 'N/A',
      m.read ? 'Yes' : 'No',
      m.created_at ? new Date(m.created_at).toLocaleString() : 'N/A'
    ]);

    const currentY = doc.lastAutoTable?.finalY || 50;
    if (currentY > 220) {
      doc.addPage();
    } else if (currentY > 50) {
      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text('Messages', 14, currentY + 12);
    } else {
      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text('Messages', 14, currentY + 8);
    }

    const startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 12 : 50;

    doc.autoTable({
      startY: startY,
      head: [['Order ID', 'Sender', 'Message', 'Type', 'Read', 'Created At']],
      body: messages,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        lineWidth: 0.2,
        lineColor: borderColor
      },
      bodyStyles: {
        fontSize: 7,
        textColor: textColor,
        lineWidth: 0.1,
        lineColor: borderColor,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }
      },
      alternateRowStyles: {
        fillColor: lightGray
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 55 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 35 }
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'wrap'
    });
  }

  // ---- Sheet 4: Export Info ----
  const currentY = doc.lastAutoTable?.finalY || 50;
  if (currentY > 240) {
    doc.addPage();
  }

  const infoStartY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 12 : 50;

  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Export Information', 14, infoStartY);

  const infoData = [
    ['Exported At', data.exportedAt],
    ['Format', 'PDF'],
    ['Profile Included', data.profile ? 'Yes' : 'No'],
    ['Orders Count', String(data.orders?.length || 0)],
    ['Messages Count', String(data.messages?.length || 0)],
    ['User ID', currentSession?.user?.id || 'Unknown'],
    ['User Email', currentSession?.user?.email || 'Unknown']
  ];

  doc.autoTable({
    startY: infoStartY + 6,
    head: [['Property', 'Value']],
    body: infoData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      lineWidth: 0.2,
      lineColor: borderColor
    },
    bodyStyles: {
      fontSize: 8,
      textColor: textColor,
      lineWidth: 0.1,
      lineColor: borderColor,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 }
    },
    alternateRowStyles: {
      fillColor: lightGray
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' }
    },
    margin: { left: 14, right: 14 },
    tableWidth: 'auto'
  });

  // Add header/footer to all pages
  addHeaderFooter(doc);

  // Write and download
  doc.save(`${filename}.pdf`);
}

// Chat history export: single PDF with messages + info
async function exportChatPDF(messages, filename) {
  const { jsPDF } = await loadPDF();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const primaryColor = [20, 53, 31];
  const secondaryColor = [100, 100, 100];
  const lightGray = [248, 250, 249];
  const white = [255, 255, 255];
  const borderColor = [224, 224, 224];
  const textColor = [51, 51, 51];

  // Helper to add header/footer
  const addHeaderFooter = (doc) => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...secondaryColor);
      doc.text('PaliTrento - Chat History Export', 14, 10);
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(0.3);
      doc.line(14, 12, 196, 12);

      doc.setFontSize(7);
      doc.setTextColor(...secondaryColor);
      doc.text(`Page ${i} of {total_pages_count_string}`, 100, 285, { align: 'center' });
      doc.text(`Exported: ${new Date().toISOString()}`, 14, 285);
      doc.setDrawColor(...borderColor);
      doc.line(14, 282, 196, 282);
    }
  };

  // Title
  doc.setFontSize(18);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Chat History', 14, 25);

  doc.setFontSize(9);
  doc.setTextColor(...secondaryColor);
  doc.setFont('helvetica', 'normal');
  doc.text(`User: ${currentSession?.user?.email || 'Unknown'}`, 14, 31);
  doc.text(`Exported: ${new Date().toISOString()}`, 14, 37);

  // Messages table
  if (messages?.length) {
    const chatData = messages.map(m => [
      m.order_id ? m.order_id.substring(0, 8) + '...' : 'N/A',
      m.sender_type || 'N/A',
      m.message ? (m.message.length > 60 ? m.message.substring(0, 57) + '...' : m.message) : 'N/A',
      m.type || 'N/A',
      m.read ? 'Yes' : 'No',
      m.created_at ? new Date(m.created_at).toLocaleString() : 'N/A'
    ]);

    doc.autoTable({
      startY: 44,
      head: [['Order ID', 'Sender', 'Message', 'Type', 'Read', 'Created At']],
      body: chatData,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        lineWidth: 0.2,
        lineColor: borderColor
      },
      bodyStyles: {
        fontSize: 7,
        textColor: textColor,
        lineWidth: 0.1,
        lineColor: borderColor,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }
      },
      alternateRowStyles: {
        fillColor: lightGray
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 55 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 35 }
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'wrap'
    });
  }

  // Export Info
  const currentY = doc.lastAutoTable?.finalY || 44;
  const infoStartY = currentY > 240 ? (doc.addPage(), 20) : currentY + 12;

  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Export Information', 14, infoStartY);

  const infoData = [
    ['Exported At', new Date().toISOString()],
    ['Format', 'PDF'],
    ['Message Count', String(messages?.length || 0)],
    ['User ID', currentSession?.user?.id || 'Unknown'],
    ['User Email', currentSession?.user?.email || 'Unknown']
  ];

  doc.autoTable({
    startY: infoStartY + 6,
    head: [['Property', 'Value']],
    body: infoData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      lineWidth: 0.2,
      lineColor: borderColor
    },
    bodyStyles: {
      fontSize: 8,
      textColor: textColor,
      lineWidth: 0.1,
      lineColor: borderColor,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 }
    },
    alternateRowStyles: {
      fillColor: lightGray
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' }
    },
    margin: { left: 14, right: 14 },
    tableWidth: 'auto'
  });

  addHeaderFooter(doc);
  doc.save(`${filename}.pdf`);
}

// Event handlers
$('#export-data-btn').addEventListener('click', async () => {
  if (!supabase || !currentSession) return alert('Not available');

  const btn = $('#export-data-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Exporting...';

  try {
    // Fetch user's order IDs using shared helper
    const orderIds = await getUserOrderIds(currentSession.user.id);

    // Fetch user data in parallel
    const [profileRes, ordersRes, messagesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', currentSession.user.id).single(),
      supabase.from('orders').select('*').in('id', orderIds),
      supabase.from('messages').select('*').in('order_id', orderIds)
    ]);

    // Check for errors in responses
    if (profileRes.error) throw profileRes.error;
    if (ordersRes.error) throw ordersRes.error;
    if (messagesRes.error) throw messagesRes.error;

    const data = {
      profile: profileRes.data,
      orders: ordersRes.data,
      messages: messagesRes.data,
      exportedAt: new Date().toISOString()
    };

    await exportPDF(data, `palitrento-data-${Date.now()}`);
  } catch (err) {
    console.error('Export error:', err);
    alert(`Failed to export data: ${err.message || 'Unknown error'}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

$('#download-data-btn').addEventListener('click', async () => {
  if (!supabase || !currentSession) return alert('Not available');

  const btn = $('#download-data-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Downloading...';

  try {
    // Fetch user's order IDs using shared helper
    const orderIds = await getUserOrderIds(currentSession.user.id);

    // Fetch chat messages for those orders
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .in('order_id', orderIds);

    if (error) throw error;

    await exportChatPDF(messages || [], `palitrento-chat-${Date.now()}`);
  } catch (err) {
    console.error('Download chat error:', err);
    alert(`Failed to download chat history: ${err.message || 'Unknown error'}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// ===== Danger Zone: Delete Account =====
function configureDangerZoneForRole() {
  if (currentProfile?.role !== 'admin') return;

  [
    {
      button: $('#delete-account-btn'),
      checkbox: $('#confirm-delete'),
      message: 'Admin accounts cannot be deleted from Settings.'
    },
    {
      button: $('#delete-store-btn'),
      checkbox: $('#confirm-delete-store'),
      message: 'Admin accounts cannot delete stores from Settings.'
    }
  ].forEach(({ button, checkbox, message }) => {
    if (!button) return;
    button.disabled = true;
    if (checkbox) checkbox.disabled = true;
    const section = button.parentElement?.parentElement;
    section?.classList.add('danger-zone-disabled');
    const notice = document.createElement('p');
    notice.className = 'danger-zone-disabled-note';
    notice.setAttribute('role', 'status');
    notice.textContent = message;
    section?.appendChild(notice);
  });
}

$('#confirm-delete').addEventListener('change', (e) => {
  $('#delete-account-btn').disabled = !e.target.checked;
});

$('#delete-account-btn').addEventListener('click', async () => {
  if (currentProfile?.role === 'admin') {
    alert('Admin accounts cannot be deleted from Settings.');
    return;
  }
  if (!confirm('FINAL WARNING: This will permanently delete your account and ALL data. Type "DELETE" to confirm.')) return;
  const input = prompt('Type DELETE to confirm:');
  if (input !== 'DELETE') return alert('Cancelled - confirmation text did not match');

  if (!supabase || !currentSession) return alert('Not available');

  try {
    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { confirmation: 'DELETE' },
    });
    if (error) {
      let message = error.message;
      if (error.context instanceof Response) {
        try {
          const responseBody = await error.context.clone().json();
          if (typeof responseBody?.error === 'string') message = responseBody.error;
        } catch (responseError) {
          console.warn('Could not read account deletion error response:', responseError);
        }
      }
      throw new Error(message);
    }
    if (data?.success !== true) throw new Error(data?.error || 'Account deletion failed');

    accountDeletionInProgress = true;
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) console.error('Local sign out after account deletion failed:', signOutError);
    clearProfileCache();

    alert('Your account and data have been permanently deleted.');
    window.location.replace('/');
  } catch (err) {
    console.error('Delete account error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    alert(`Failed to delete account: ${message}`);
  }
});

// ===== Danger Zone: Delete Store =====
$('#confirm-delete-store').addEventListener('change', (e) => {
  $('#delete-store-btn').disabled = !e.target.checked;
});

$('#delete-store-btn').addEventListener('click', async () => {
  if (currentProfile?.role === 'admin') {
    alert('Admin accounts cannot delete stores from Settings.');
    return;
  }
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
      renderChrome('/settings/', currentSession, currentProfile);
    }

    alert('Store deleted successfully');
    window.location.href = '/account/';
  } catch (err) {
    console.error('Delete store error:', err);
    alert('Failed to delete store. Please contact support.');
  }
});

// ===== Auth State Change =====
onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    clearProfileCache();
    if (!accountDeletionInProgress) window.location.href = '/login/';
  }
});

// Helper
function $$ (s, r = document) { return r.querySelectorAll(s); }

// Initialize
loadSettings();

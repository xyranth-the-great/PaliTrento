import { renderChrome, $, esc } from './ui.js';
import { getSessionWithStatus, getCachedProfile, isSupabaseConfigured } from './auth.js';
import { supabase } from './supabase.js';

const accountList = $('#account-list');
const listMessage = $('#account-list-message');
const dialog = $('#moderation-dialog');
const form = $('#moderation-form');
const durationField = $('#duration-field');
const durationSelect = $('#moderation-duration');
const customDurationInput = $('#custom-duration-days');
const warningField = $('#warning-field');
const warningMessageInput = $('#warning-message');
const reasonInput = $('#moderation-reason');
const moderationMessage = $('#moderation-message');
const submitButton = $('#moderation-submit');
const cancelButton = $('#moderation-cancel');
let currentSession = null;
let currentTarget = null;
let currentAction = null;
let accounts = [];

// Duration options in hours
const DURATION_OPTIONS = {
  24: '1 Day',
  72: '3 Days',
  168: '7 Days',
  336: '14 Days',
  720: '30 Days',
};

async function init() {
  if (!isSupabaseConfigured()) {
    listMessage.textContent = 'Account moderation requires a Supabase connection.';
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

  if (!profile || profile.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  renderChrome('/admin-accounts/', session, profile);
  $('#account-search').addEventListener('input', renderAccounts);
  $('#account-filter').addEventListener('change', renderAccounts);
  accountList.addEventListener('click', onAccountAction);
  cancelButton.addEventListener('click', () => dialog.close());
  form.addEventListener('submit', submitModeration);

  // Custom duration toggle
  durationSelect.addEventListener('change', () => {
    const isCustom = durationSelect.value === 'custom';
    customDurationInput.style.display = isCustom ? 'block' : 'none';
    customDurationInput.required = isCustom;
    if (!isCustom) customDurationInput.value = '';
  });

  // Handle warning message field
  // No special handling needed - just show/hide based on action

  await loadAccounts();
}

async function loadAccounts() {
  listMessage.textContent = 'Loading accounts...';
  const { data, error } = await supabase.functions.invoke('admin-account-moderation', {
    body: { action: 'list' },
  });
  if (error || data?.error) {
    listMessage.textContent = data?.error || 'Could not load accounts. Deploy the moderation function and SQL migration first.';
    return;
  }
  accounts = data.accounts || [];
  listMessage.textContent = accounts.length ? `${accounts.length} accounts` : 'No accounts found.';
  renderAccounts();
}

function accountIsSuspended(account) {
  return account.account_status === 'suspended'
    && (!account.suspended_until || new Date(account.suspended_until).getTime() > Date.now());
}

function accountIsBanned(account) {
  return account.account_status === 'banned';
}

function getAccountStatus(account) {
  if (accountIsBanned(account)) return 'banned';
  if (accountIsSuspended(account)) return 'suspended';
  return 'active';
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

function actionLabel(action) {
  return ({
    warn: 'Warning',
    suspend_temporary: 'Temporary suspension',
    suspend_permanent: 'Permanent suspension',
    ban: 'Permanent ban',
    restore: 'Restore access',
    unban: 'Remove ban',
  })[action] || action;
}

function getAvailableActions(account) {
  const status = getAccountStatus(account);
  const ownAdmin = account.id === currentSession.user.id && account.role === 'admin';

  if (ownAdmin) {
    return []; // No actions for own admin account
  }

  const baseActions = [
    { value: 'warn', label: 'Issue warning' },
  ];

  if (status === 'active') {
    baseActions.push(
      { value: 'suspend_temporary', label: 'Temporary suspension' },
      { value: 'suspend_permanent', label: 'Permanent suspension' },
      { value: 'ban', label: 'Permanent ban' }
    );
    if (account.auth_banned) {
      baseActions.push({ value: 'restore', label: 'Clear sign-in restriction' });
    }
  } else if (status === 'suspended') {
    baseActions.push(
      { value: 'restore', label: 'Restore access' }
    );
  } else if (status === 'banned') {
    baseActions.push(
      { value: 'unban', label: 'Remove ban' }
    );
  }

  return baseActions;
}

function renderAccounts() {
  const search = $('#account-search').value.trim().toLowerCase();
  const filter = $('#account-filter').value;
  const visible = accounts.filter((account) => {
    const status = getAccountStatus(account);
    const matchesSearch = `${account.full_name || ''} ${account.email || ''}`.toLowerCase().includes(search);
    return matchesSearch && (filter === 'all' || filter === status);
  });

  if (!visible.length) {
    accountList.innerHTML = accounts.length ? '<p class="muted">No accounts match this filter.</p>' : '';
    return;
  }

  accountList.innerHTML = visible.map((account) => {
    const suspended = accountIsSuspended(account);
    const banned = accountIsBanned(account);
    const expired = account.account_status === 'suspended' && !suspended;
    const ownAdmin = account.id === currentSession.user.id && account.role === 'admin';

    let statusText = '';
    let statusPillClass = 'ok';
    let statusExtra = '';

    if (banned) {
      statusText = 'Banned';
      statusPillClass = 'bad';
      if (account.ban_reason) {
        statusExtra = `<div class="ban-reason">${esc(account.ban_reason)}</div>`;
      }
    } else if (suspended) {
      statusText = `Suspended${account.suspended_until ? ` until ${esc(formatDate(account.suspended_until))}` : ' permanently'}`;
      statusPillClass = 'bad';
      if (account.suspension_reason) {
        statusExtra = `<div class="suspension-reason">${esc(account.suspension_reason)}</div>`;
      }
    } else if (expired) {
      statusText = 'Suspension expired';
      statusPillClass = 'warn';
      if (account.auth_banned) {
        statusExtra = '<div class="suspension-reason">Supabase sign-in is still blocked</div>';
      }
    } else if (account.auth_banned) {
      statusText = 'Active · sign-in blocked';
      statusPillClass = 'warn';
      statusExtra = '<div class="suspension-reason">Use “Clear sign-in restriction” to restore login.</div>';
    } else {
      statusText = 'Active';
      statusPillClass = 'ok';
    }

    const actions = getAvailableActions(account);

    const recentActions = (account.recent_actions || []).map((action) => `
      <div style="padding:6px 0;border-top:1px solid var(--line)">
        <strong>${esc(actionLabel(action.action))}</strong> · ${esc(formatDate(action.created_at))}
        ${action.actor_name ? `<span class="actor-name">by ${esc(action.actor_name)}</span>` : ''}<br>
        <span class="muted">${esc(action.reason)}</span>
        ${action.expires_at ? `<span class="muted" style="font-size:.75rem">Expires: ${esc(formatDate(action.expires_at))}</span>` : ''}
      </div>
    `).join('');

    return `
      <article class="account-row">
        <div class="account-identity">
          <span class="account-name">${esc(account.full_name || 'Unnamed account')}</span>
          <span class="account-email">${esc(account.email || 'Email unavailable')}</span>
        </div>
        <div class="account-role"><span class="pill info">${esc(account.role || 'customer')}</span></div>
        <div class="account-status">
          <span class="pill ${statusPillClass}">${statusText}</span>
          ${statusExtra}
        </div>
        <div class="account-actions">
          <select data-action-select="${esc(account.id)}" aria-label="Moderation action for ${esc(account.full_name || account.email || 'account')}" ${ownAdmin ? 'disabled' : ''}>
            <option value="">Choose action</option>
            ${actions.map(a => `<option value="${a.value}">${a.label}</option>`).join('')}
          </select>
          <button type="button" class="btn" data-moderate="${esc(account.id)}" ${ownAdmin ? 'disabled' : ''}>Apply</button>
        </div>
        ${(account.recent_actions || []).length ? `<details class="account-history"><summary>Moderation history (${account.recent_actions.length})</summary><div style="padding-top:8px">${recentActions}</div></details>` : ''}
      </article>
    `;
  }).join('');
}

function onAccountAction(event) {
  const button = event.target.closest('[data-moderate]');
  if (!button) return;
  const targetId = button.dataset.moderate;
  const actionSelect = accountList.querySelector(`[data-action-select="${CSS.escape(targetId)}"]`);
  const action = actionSelect?.value;
  const target = accounts.find((account) => account.id === targetId);
  if (!target || !action) {
    listMessage.textContent = 'Choose a moderation action first.';
    return;
  }

  currentTarget = target;
  currentAction = action;
  $('#moderation-title').textContent = actionLabel(action);
  $('#moderation-account').textContent = `${target.full_name || target.email || 'Account'} · ${target.role}`;

  // Reset fields
  durationField.style.display = 'none';
  warningField.style.display = 'none';
  reasonInput.value = '';
  warningMessageInput.value = '';
  durationSelect.value = '168'; // Default 7 days
  customDurationInput.style.display = 'none';
  customDurationInput.value = '';
  customDurationInput.required = false;
  moderationMessage.textContent = '';

  // Configure fields based on action
  if (action === 'suspend_temporary') {
    durationField.style.display = 'block';
    reasonInput.required = true;
    warningMessageInput.required = false;
    moderationMessage.textContent = 'This ends active sessions and blocks sign-in for the selected period.';
  } else if (action === 'suspend_permanent') {
    durationField.style.display = 'none';
    reasonInput.required = true;
    warningMessageInput.required = false;
    moderationMessage.textContent = 'This blocks sign-in and protected data access until an administrator restores the account.';
  } else if (action === 'ban') {
    durationField.style.display = 'none';
    reasonInput.required = true;
    warningMessageInput.required = false;
    moderationMessage.textContent = 'This permanently restricts the account. Only an administrator can reverse this.';
  } else if (action === 'warn') {
    durationField.style.display = 'none';
    warningField.style.display = 'block';
    warningMessageInput.required = true;
    reasonInput.required = true; // Admin reason for internal record
    moderationMessage.textContent = 'A warning notification will be sent to the user. This does not restrict account access.';
  } else if (action === 'restore') {
    durationField.style.display = 'none';
    reasonInput.required = true;
    warningMessageInput.required = false;
    moderationMessage.textContent = 'Restoring access will allow the account to sign in and use the system again.';
  } else if (action === 'unban') {
    durationField.style.display = 'none';
    reasonInput.required = true;
    warningMessageInput.required = false;
    moderationMessage.textContent = 'Removing the ban will restore full account access.';
  }

  dialog.showModal();
  reasonInput.focus();
}

async function submitModeration(event) {
  event.preventDefault();

  const reason = reasonInput.value.trim();
  const warningMessage = warningMessageInput.value.trim();

  if (currentAction === 'warn' && !warningMessage) {
    moderationMessage.textContent = 'Warning message is required.';
    warningMessageInput.focus();
    return;
  }

  if ((currentAction !== 'warn') && !reason) {
    moderationMessage.textContent = 'A reason is required.';
    reasonInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Applying...';
  moderationMessage.textContent = '';

  try {
    const request = {
      action: 'moderate',
      targetUserId: currentTarget.id,
      moderationAction: currentAction,
      reason: currentAction === 'warn' ? warningMessage : reason,
    };

    if (currentAction === 'suspend_temporary') {
      if (durationSelect.value === 'custom') {
        const days = parseInt(customDurationInput.value, 10);
        if (!days || days < 1 || days > 365) {
          moderationMessage.textContent = 'Enter a valid number of days (1-365).';
          customDurationInput.focus();
          submitButton.disabled = false;
          submitButton.textContent = 'Confirm';
          return;
        }
        request.customDurationDays = days;
      } else {
        request.durationHours = parseInt(durationSelect.value, 10);
      }
    }

    console.log('[admin-accounts] Sending moderation request:', request);
    const { data, error } = await supabase.functions.invoke('admin-account-moderation', { body: request });
    console.log('[admin-accounts] Moderation response - data:', data, 'error:', error);
    console.log('[admin-accounts] Moderation response - data.result:', data?.result);
    console.log('[admin-accounts] Moderation response - data.warning:', data?.warning);
    if (error || data?.error) {
      moderationMessage.textContent = data?.error || error?.message || 'Moderation failed. Try again.';
      console.error('[admin-accounts] Moderation failed:', data?.error || error);
      return;
    }
    console.log('[admin-accounts] Moderation succeeded');

    dialog.close();
    listMessage.textContent = data.warning
      ? `${actionLabel(currentAction)} recorded. ${data.warning}`
      : `${actionLabel(currentAction)} recorded.`;
    await loadAccounts();
  } catch (err) {
    console.error('Moderation error:', err);
    moderationMessage.textContent = 'An unexpected error occurred. Try again.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Confirm';
  }
}

init();
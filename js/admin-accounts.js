import { renderChrome, $, esc } from './ui.js';
import { getSession, getCachedProfile, isSupabaseConfigured } from './auth.js';
import { supabase } from './supabase.js';

const accountList = $('#account-list');
const listMessage = $('#account-list-message');
const dialog = $('#moderation-dialog');
const form = $('#moderation-form');
const durationField = $('#duration-field');
const durationSelect = $('#moderation-duration');
const reasonInput = $('#moderation-reason');
const moderationMessage = $('#moderation-message');
let currentSession = null;
let currentTarget = null;
let currentAction = null;
let accounts = [];

async function init() {
  if (!isSupabaseConfigured()) {
    listMessage.textContent = 'Account moderation requires a Supabase connection.';
    return;
  }

  currentSession = await getSession();
  if (!currentSession) {
    window.location.href = '/login/';
    return;
  }

  const profile = await getCachedProfile(currentSession.user.id);
  if (!profile || profile.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  renderChrome('/admin-accounts/', currentSession, profile);
  $('#account-search').addEventListener('input', renderAccounts);
  $('#account-filter').addEventListener('change', renderAccounts);
  accountList.addEventListener('click', onAccountAction);
  $('#moderation-cancel').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', submitModeration);
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

function renderAccounts() {
  const search = $('#account-search').value.trim().toLowerCase();
  const filter = $('#account-filter').value;
  const visible = accounts.filter((account) => {
    const suspended = accountIsSuspended(account);
    const matchesSearch = `${account.full_name || ''} ${account.email || ''}`.toLowerCase().includes(search);
    return matchesSearch && (filter === 'all' || (filter === 'suspended') === suspended);
  });

  if (!visible.length) {
    accountList.innerHTML = accounts.length ? '<p class="muted">No accounts match this filter.</p>' : '';
    return;
  }

  accountList.innerHTML = visible.map((account) => {
    const suspended = accountIsSuspended(account);
    const expired = account.account_status === 'suspended' && !suspended;
    const status = suspended
      ? `Suspended${account.suspended_until ? ` until ${esc(formatDate(account.suspended_until))}` : ' permanently'}`
      : expired ? 'Suspension expired' : 'Active';
    const ownAdmin = account.id === currentSession.user.id && account.role === 'admin';
    const recentActions = (account.recent_actions || []).map((action) => `
      <div style="padding:6px 0;border-top:1px solid var(--line)">
        <strong>${esc(actionLabel(action.action))}</strong> · ${esc(formatDate(action.created_at))}<br>
        <span class="muted">${esc(action.reason)}</span>
      </div>
    `).join('');

    return `
      <article class="account-row">
        <div><strong>${esc(account.full_name || 'Unnamed account')}</strong><br><span class="muted">${esc(account.email || 'Email unavailable')}</span></div>
        <div><span class="pill info">${esc(account.role || 'customer')}</span></div>
        <div><span class="pill ${suspended ? 'bad' : 'ok'}">${status}</span>${account.suspension_reason && suspended ? `<div class="muted" style="font-size:.85rem;margin-top:4px">${esc(account.suspension_reason)}</div>` : ''}</div>
        <div class="account-actions">
          <select data-action-select="${esc(account.id)}" aria-label="Moderation action for ${esc(account.full_name || account.email || 'account')}" ${ownAdmin ? 'disabled' : ''}>
            <option value="">Choose action</option>
            <option value="warn">Issue warning</option>
            <option value="suspend_temporary">Temporary suspension</option>
            <option value="suspend_permanent">Permanent suspension</option>
            ${account.account_status === 'suspended' ? '<option value="restore">Restore access</option>' : ''}
          </select>
          <button type="button" class="btn" data-moderate="${esc(account.id)}" ${ownAdmin ? 'disabled' : ''}>Apply</button>
        </div>
        ${(account.recent_actions || []).length ? `<details style="grid-column:1/-1"><summary>Recent moderation history</summary><div style="padding-top:8px">${recentActions}</div></details>` : ''}
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
  durationField.style.display = action === 'suspend_temporary' ? 'block' : 'none';
  moderationMessage.textContent = action === 'warn'
    ? 'A warning does not block account access.'
    : action === 'suspend_permanent'
      ? 'This blocks sign-in and protected data access until an administrator restores the account.'
      : action === 'suspend_temporary'
        ? 'This ends active sessions and blocks sign-in and protected data access for the selected period.'
        : 'Restoring access will allow the account to sign in and use the system again.';
  reasonInput.value = '';
  dialog.showModal();
  reasonInput.focus();
}

async function submitModeration(event) {
  event.preventDefault();
  const submitButton = $('#moderation-submit');
  submitButton.disabled = true;
  submitButton.textContent = 'Applying...';

  const request = {
    action: 'moderate',
    targetUserId: currentTarget.id,
    moderationAction: currentAction,
    reason: reasonInput.value.trim(),
  };
  if (currentAction === 'suspend_temporary') request.durationHours = Number(durationSelect.value);

  const { data, error } = await supabase.functions.invoke('admin-account-moderation', { body: request });
  submitButton.disabled = false;
  submitButton.textContent = 'Confirm';
  if (error || data?.error) {
    moderationMessage.textContent = data?.error || 'Moderation failed. Try again.';
    return;
  }

  dialog.close();
  listMessage.textContent = data.warning || `${actionLabel(currentAction)} recorded.`;
  await loadAccounts();
}

function actionLabel(action) {
  return ({
    warn: 'Warning',
    suspend_temporary: 'Temporary suspension',
    suspend_permanent: 'Permanent suspension',
    restore: 'Access restored',
  })[action] || action;
}

function formatDate(value) {
  return new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

init();
import { renderChrome, $, esc } from './ui.js';
import { getSessionWithStatus, checkAuthErrorParams } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured } from './auth.js';

async function init() {
  if (!isSupabaseConfigured()) return;

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
  if (!profile || profile.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  renderChrome('/admin-activity/', session, profile);
  $('#activity-refresh').addEventListener('click', loadActivity);
  $('#activity-action-filter').addEventListener('change', loadActivity);
  await loadActivity();
}

async function loadActivity() {
  const errorEl = $('#activity-error');
  const emptyEl = $('#activity-empty');
  const rowsEl = $('#activity-rows');
  errorEl.style.display = 'none';
  emptyEl.style.display = 'none';
  rowsEl.innerHTML = '<tr><td colspan="5" class="muted" style="padding:18px">Loading activity…</td></tr>';

  try {
    let query = supabase
      .from('audit_logs')
      .select('id,actor_user_id,actor_name,actor_role,target_user_id,target_name,action,resource_type,resource_id,summary,changed_fields,created_at')
      .order('created_at', { ascending: false })
      .limit(250);
    const action = $('#activity-action-filter').value;
    if (action) query = query.eq('action', action);

    const { data, error } = await query;
    if (error) throw error;

    const logs = data || [];
    $('#activity-count').textContent = `${logs.length} recent record${logs.length === 1 ? '' : 's'}`;
    if (logs.length === 0) {
      rowsEl.replaceChildren();
      emptyEl.style.display = 'block';
      return;
    }

    rowsEl.innerHTML = logs.map(log => {
      const actorName = log.actor_name || (log.actor_user_id ? `User ${log.actor_user_id.slice(0, 8)}` : 'System');
      const targetText = log.target_user_id && log.target_user_id !== log.actor_user_id
        ? `<div class="muted" style="font-size:.75rem">For ${esc(log.target_name || `User ${log.target_user_id.slice(0, 8)}`)}</div>`
        : '';
      const changedFields = Array.isArray(log.changed_fields) && log.changed_fields.length
        ? log.changed_fields.map(field => esc(field.replaceAll('_', ' '))).join(', ')
        : '—';
      const summary = log.summary || log.resource_id || log.resource_type;
      return `
        <tr style="border-bottom:1px solid var(--line)">
          <td style="padding:10px;white-space:nowrap">${new Date(log.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</td>
          <td style="padding:10px">${esc(actorName)}<div class="muted" style="font-size:.75rem">${esc(log.actor_role || 'user')}</div>${targetText}</td>
          <td style="padding:10px"><span class="pill ${log.action === 'DELETE' ? 'bad' : log.action === 'INSERT' ? 'ok' : 'info'}">${esc(log.action)}</span><div class="muted" style="font-size:.75rem">${esc(log.resource_type)}</div></td>
          <td style="padding:10px">${esc(summary)}${log.resource_id ? `<div class="muted" style="font-size:.72rem">${esc(log.resource_id.slice(0, 12))}</div>` : ''}</td>
          <td style="padding:10px">${changedFields}</td>
        </tr>`;
    }).join('');
  } catch (error) {
    console.error('Admin activity log error:', error);
    rowsEl.replaceChildren();
    $('#activity-count').textContent = 'Activity log unavailable';
    errorEl.textContent = error?.code === '42P01' || error?.code === 'PGRST205'
      ? 'Audit logging is not installed yet. Apply supabase/migrations/008_admin_audit_logs.sql.'
      : `Could not load activity records. ${error?.message || 'Please retry.'}`;
    errorEl.style.display = 'block';
  }
}

init();

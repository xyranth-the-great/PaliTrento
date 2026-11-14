import { renderChrome, $, esc, BARANGAYS } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
import { supabase } from './supabase.js';
import { isSupabaseConfigured } from './auth.js';

const form = $('#broadcast-form');
const msgEl = $('#broadcast-msg');
const list = $('#broadcasts-list');
const noList = $('#no-broadcasts');
const barangaySelect = $('#b-barangay');

async function init() {
  if (!isSupabaseConfigured()) return;

  const session = await getSession();
  if (!session) {
    window.location.href = '/login/';
    return;
  }

  const profile = await getCachedProfile(session.user.id);
  if (!profile || profile.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  renderChrome('/admin-prices/', session, profile);

  // Populate barangay
  barangaySelect.innerHTML = '<option value="">All barangays</option>' +
    BARANGAYS.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');

  form.addEventListener('submit', handleSubmit);
  await loadBroadcasts();
}

async function handleSubmit(e) {
  e.preventDefault();
  msgEl.style.display = 'none';

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  try {
    const session = await getSession();
    const broadcast = {
      title: form.title.value.trim(),
      body: form.body.value.trim(),
      category: form.category.value,
      priority: form.priority.value,
      barangay: form.barangay.value || null,
      expires_at: form.expires_at.value ? new Date(form.expires_at.value).toISOString() : null,
      created_by: session.user.id,
    };

    if (!broadcast.title || !broadcast.body) {
      showMsg('Title and message are required', 'bad');
      return;
    }

    const { error } = await supabase.from('advisories').insert(broadcast);
    if (error) throw error;

    showMsg('Broadcast sent successfully!', 'ok');
    form.reset();
    await loadBroadcasts();
  } catch (err) {
    console.error('Broadcast error:', err);
    showMsg('Failed to send. Please try again.', 'bad');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Broadcast';
  }
}

async function loadBroadcasts() {
  const { data, error } = await supabase
    .from('advisories')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    list.style.display = 'none';
    noList.style.display = 'block';
    return;
  }

  noList.style.display = 'none';
  list.style.display = 'grid';

  list.innerHTML = data.map(b => `
    <div class="card" style="border-left:4px solid ${priorityColor(b.priority)}">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <h3 style="margin:0;font-size:1rem">${esc(b.title)}</h3>
        <span class="pill ${categoryColor(b.category)}" style="font-size:.7rem">${b.category}</span>
      </div>
      <p class="muted" style="margin:0 0 8px;font-size:.85rem">${esc(b.body)}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:.75rem;color:var(--muted)">
        <span>Priority: <strong>${b.priority}</strong></span>
        <span>Barangay: <strong>${b.barangay || 'All'}</strong></span>
        <span>Sent: <strong>${new Date(b.published_at).toLocaleString('en-PH')}</strong></span>
        ${b.expires_at ? `<span>Expires: <strong>${new Date(b.expires_at).toLocaleString('en-PH')}</strong></span>` : ''}
      </div>
    </div>
  `).join('');
}

function categoryColor(cat) {
  const map = { PRICE_CAP: 'ok', ANNOUNCEMENT: 'info', EMERGENCY: 'bad', GENERAL: 'warn' };
  return map[cat] || 'warn';
}

function priorityColor(pri) {
  const map = { low: 'var(--muted)', normal: 'var(--info)', high: 'var(--warn)', critical: 'var(--bad)' };
  return map[pri] || 'var(--info)';
}

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = `pill ${type}`;
}

init();
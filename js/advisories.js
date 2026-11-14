import { renderChrome, $, esc, startAdvisoryToastListener, openNotificationModal } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
import { supabase } from './supabase.js';

const session = await getSession();
let profile = null;
if (session) profile = await getCachedProfile(session.user.id);
renderChrome('/advisories/', session, profile);

// Start advisory toast listener for logged-in users
if (session) {
  startAdvisoryToastListener();
}

if (!session) {
  $('#list').innerHTML = `
    <div class="empty" style="grid-column:1/-1;text-align:center;padding:48px 24px">
      <h3>Please log in to view notifications</h3>
      <p class="muted" style="margin-top:8px">You need to be logged in to see your notifications.</p>
      <a href="/login/" class="btn" style="margin-top:16px;display:inline-block">Log in</a>
    </div>
  `;
  $('#count').textContent = '';
  $('#pagination').innerHTML = '';
} else {
  // Initialize the page
  initAdvisoriesPage();
}

const PAGE_SIZE = 20;
let currentPage = 1;
let totalPages = 1;
let allAdvisories = [];
let filteredAdvisories = [];

async function initAdvisoriesPage() {
  await loadAllAdvisories();
  setupFilters();
  renderPage();
}

async function loadAllAdvisories() {
  if (!supabase || !session) return;
  const userId = session.user.id;

  $('#list').innerHTML = '<div class="muted" style="padding:16px;text-align:center;grid-column:1/-1">Loading...</div>';

  try {
    // Get all active advisories (no limit)
    const { data: advisories, error } = await supabase
      .from('advisories')
      .select('id, title, body, category, priority, published_at, barangay')
      .lte('published_at', new Date().toISOString())
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('published_at', { ascending: false });

    if (error) throw error;

    if (!advisories?.length) {
      allAdvisories = [];
      filteredAdvisories = [];
      return;
    }

    // Get read status for all advisories
    const { data: reads } = await supabase
      .from('notification_reads')
      .select('advisory_id')
      .eq('user_id', userId)
      .in('advisory_id', advisories.map(a => a.id));

    const readIds = new Set((reads || []).map(r => r.advisory_id));

    // Add read status to each advisory
    allAdvisories = advisories.map(a => ({
      ...a,
      isRead: readIds.has(a.id)
    }));

    filteredAdvisories = [...allAdvisories];
  } catch (err) {
    console.error('Load all advisories error:', err);
    $('#list').innerHTML = '<div class="pill bad" style="padding:16px;text-align:center;grid-column:1/-1">Failed to load notifications</div>';
    $('#count').textContent = '';
    $('#pagination').innerHTML = '';
  }
}

function setupFilters() {
  const qInput = $('#q');
  const catSelect = $('#cat');
  const statusSelect = $('#status');

  function applyFilters() {
    const q = qInput.value.trim().toLowerCase();
    const cat = catSelect.value;
    const status = statusSelect.value;

    filteredAdvisories = allAdvisories.filter(a => {
      const matchesSearch = !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q);
      const matchesCategory = !cat || a.category === cat;
      const matchesStatus = !status || (status === 'unread' ? !a.isRead : a.isRead);
      return matchesSearch && matchesCategory && matchesStatus;
    });

    currentPage = 1;
    renderPage();
  }

  // Debounce search input
  let searchTimeout = null;
  qInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 200);
  });

  catSelect.addEventListener('change', applyFilters);
  statusSelect.addEventListener('change', applyFilters);
}

function renderPage() {
  totalPages = Math.ceil(filteredAdvisories.length / PAGE_SIZE) || 1;
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageItems = filteredAdvisories.slice(start, end);

  // Update count
  const unreadCount = filteredAdvisories.filter(a => !a.isRead).length;
  $('#count').textContent = `${filteredAdvisories.length} notification${filteredAdvisories.length !== 1 ? 's' : ''} ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`;

  if (pageItems.length === 0) {
    $('#list').innerHTML = '';
    $('#empty').hidden = false;
    $('#pagination').innerHTML = '';
    return;
  }

  $('#empty').hidden = true;

  // Render items
  $('#list').innerHTML = pageItems.map(a => {
    const catColor = { PRICE_CAP: 'ok', ANNOUNCEMENT: 'info', EMERGENCY: 'bad', GENERAL: 'warn' }[a.category] || 'warn';
    return `
      <button class="notification-item ${a.isRead ? 'read' : 'unread'}" data-id="${a.id}" role="option" tabindex="0">
        <span class="notification-cat pill ${catColor}">${a.category.replace('_', ' ')}</span>
        <div class="notification-content">
          <strong>${esc(a.title)}</strong>
          <p class="muted">${esc(a.body)}</p>
          <span class="muted">${new Date(a.published_at).toLocaleString('en-PH')}${a.barangay ? ` • ${esc(a.barangay)}` : ''}</span>
        </div>
        ${!a.isRead ? '<span class="notification-dot" aria-hidden="true"></span>' : ''}
      </button>
    `;
  }).join('');

  // Add click handlers
  $('#list').querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = item.dataset.id;
      const advisory = allAdvisories.find(a => a.id === id);
      if (advisory) {
        await openNotificationModal(advisory);
        // Update local state and UI
        advisory.isRead = true;
        item.classList.remove('unread');
        item.classList.add('read');
        item.querySelector('.notification-dot')?.remove();
        updateCountDisplay();
      }
    });
  });

  renderPagination();
}

function updateCountDisplay() {
  const unreadCount = filteredAdvisories.filter(a => !a.isRead).length;
  $('#count').textContent = `${filteredAdvisories.length} notification${filteredAdvisories.length !== 1 ? 's' : ''} ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`;
}

function renderPagination() {
  const pagination = $('#pagination');
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';

  // Previous button
  html += `
    <button class="btn alt" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" style="padding:8px 16px;font-size:.9rem">
      Previous
    </button>
  `;

  // Page numbers (show max 5 pages centered on current)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="${i === currentPage ? 'btn' : 'btn alt'}" data-page="${i}" style="padding:8px 16px;font-size:.9rem;min-width:44px">
        ${i}
      </button>
    `;
  }

  // Next button
  html += `
    <button class="btn alt" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}" style="padding:8px 16px;font-size:.9rem">
      Next
    </button>
  `;

  pagination.innerHTML = html;

  // Add click handlers
  pagination.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page, 10);
      if (page >= 1 && page <= totalPages && page !== currentPage) {
        currentPage = page;
        renderPage();
        // Scroll to top of list
        $('#list').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}
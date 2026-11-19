import { renderChrome, $, esc, CATS, peso } from './ui.js';
import { getSessionWithStatus, checkAuthErrorParams, isSupabaseConfigured } from './auth.js';
import { supabase } from './supabase.js';

let currentSession = null;
let activeKind = 'stores';
let stores = [];
let products = [];

async function init() {
  if (!isSupabaseConfigured()) {
    showMessage('Marketplace management requires a database connection.');
    return;
  }

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
  if (profile?.role !== 'admin') {
    window.location.replace('/');
    return;
  }

  currentSession = session;
  renderChrome('/admin-marketplace/', session, profile);
  bindEvents();
  await loadListings();
}

function bindEvents() {
  document.querySelectorAll('[data-kind]').forEach(button => {
    button.addEventListener('click', () => {
      activeKind = button.dataset.kind;
      document.querySelectorAll('[data-kind]').forEach(tab => {
        tab.setAttribute('aria-selected', tab === button ? 'true' : 'false');
      });
      renderListings();
    });
  });
  $('#market-search').addEventListener('input', renderListings);
  $('#market-filter').addEventListener('change', renderListings);
  $('#market-list').addEventListener('click', handleListingAction);
}

async function loadListings() {
  showMessage('Loading listings…');
  const [storeResult, productResult] = await Promise.all([
    supabase.from('stores')
      .select('id, user_id, business_name, trade_category, barangay, trn_code, marketplace_removed_at, marketplace_removal_reason')
      .order('business_name'),
    supabase.from('products')
      .select('id, store_id, name, category, current_price, marketplace_removed_at, marketplace_removal_reason')
      .order('name')
  ]);

  if (storeResult.error || productResult.error) {
    console.error('Could not load marketplace listings:', storeResult.error || productResult.error);
    showMessage('Could not load listings. Check the marketplace removal migration and try again.');
    return;
  }

  stores = storeResult.data || [];
  products = productResult.data || [];
  renderListings();
}

function renderListings() {
  const list = $('#market-list');
  const message = $('#market-message');
  const query = $('#market-search').value.trim().toLowerCase();
  const filter = $('#market-filter').value;
  const storeById = new Map(stores.map(store => [store.id, store]));
  const source = activeKind === 'stores' ? stores : products;
  const filtered = source.filter(item => {
    const store = activeKind === 'products' ? storeById.get(item.store_id) : null;
    const marketHidden = Boolean(item.marketplace_removed_at || store?.marketplace_removed_at);
    if (filter === 'public' && marketHidden) return false;
    if (filter === 'removed' && !marketHidden) return false;
    const haystack = activeKind === 'stores'
      ? `${item.business_name} ${item.trn_code} ${item.barangay} ${CATS[item.trade_category] || item.trade_category}`
      : `${item.name} ${item.category || ''} ${store?.business_name || ''} ${store?.trn_code || ''}`;
    return !query || haystack.toLowerCase().includes(query);
  });

  $('#market-summary').textContent = `${filtered.length} ${activeKind === 'stores' ? 'store' : 'product'} listing${filtered.length === 1 ? '' : 's'}`;
  if (!filtered.length) {
    list.innerHTML = '';
    message.textContent = 'No listings match this filter.';
    message.style.display = 'block';
    return;
  }

  message.style.display = 'none';
  list.innerHTML = filtered.map(item => renderListing(item, storeById)).join('');
}

function renderListing(item, storeById) {
  const isStore = activeKind === 'stores';
  const removed = Boolean(item.marketplace_removed_at);
  const store = isStore ? item : storeById.get(item.store_id);
  const hiddenWithStore = !isStore && !removed && Boolean(store?.marketplace_removed_at);
  const marketHidden = removed || hiddenWithStore;
  const title = isStore ? item.business_name : item.name;
  const detail = isStore
    ? `${CATS[item.trade_category] || item.trade_category} · ${item.barangay || 'No barangay'} · ${item.trn_code}`
    : `${store?.business_name || 'Unknown store'} · ${item.category || 'Uncategorized'} · ${peso(item.current_price)}`;
  const relatedCount = isStore ? products.filter(product => product.store_id === item.id).length : 0;

  return `
    <article class="market-admin-item">
      <div class="market-admin-copy">
        <h2>${esc(title || 'Untitled listing')}</h2>
        <p>${esc(detail)}</p>
        ${isStore ? `<p>${relatedCount} product${relatedCount === 1 ? '' : 's'} · removing this store hides all of them</p>` : ''}
        <span class="pill ${marketHidden ? 'bad' : 'ok'} market-admin-status">${removed ? 'Removed from marketplace' : hiddenWithStore ? 'Hidden with store' : 'In marketplace'}</span>
        ${removed && item.marketplace_removal_reason ? `<div class="market-admin-removal-reason"><strong>Reason:</strong> ${esc(item.marketplace_removal_reason)}</div>` : ''}
        ${hiddenWithStore && store?.marketplace_removal_reason ? `<div class="market-admin-removal-reason"><strong>Store removal reason:</strong> ${esc(store.marketplace_removal_reason)}</div>` : ''}
      </div>
      <div class="market-admin-actions">
        <button type="button" class="btn ${removed ? '' : 'bad'}" data-action="${removed ? 'restore' : 'remove'}" data-kind="${isStore ? 'stores' : 'products'}" data-id="${esc(item.id)}">
          ${removed ? 'Restore' : 'Remove'}
        </button>
      </div>
    </article>`;
}

async function handleListingAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action, kind, id } = button.dataset;
  const item = (kind === 'stores' ? stores : products).find(row => row.id === id);
  if (!item) return;

  const isStore = kind === 'stores';
  const name = isStore ? item.business_name : item.name;
  const prompt = action === 'remove'
    ? isStore
      ? `Hide “${name}” and all its products from the public marketplace? You can restore them later.`
      : `Hide “${name}” from the public marketplace? You can restore it later.`
    : `Restore “${name}” to the public marketplace?`;
  let removalReason = null;
  if (action === 'remove') {
    const enteredReason = window.prompt(`Reason for removing ${isStore ? 'this store' : 'this product'} from the marketplace:`, item.marketplace_removal_reason || '');
    if (enteredReason === null) return;
    removalReason = enteredReason.trim();
    if (!removalReason) {
      window.alert('Please enter a reason before removing this listing.');
      return;
    }
  }
  if (!window.confirm(prompt)) return;

  button.disabled = true;
  const update = action === 'remove'
    ? { marketplace_removed_at: new Date().toISOString(), marketplace_removed_by: currentSession.user.id, marketplace_removal_reason: removalReason }
    : { marketplace_removed_at: null, marketplace_removed_by: null, marketplace_removal_reason: null };
  const { error } = await supabase.from(kind).update(update).eq('id', id);
  if (error) {
    console.error(`Could not ${action} marketplace listing:`, error);
    button.disabled = false;
    window.alert(error.message || 'Could not update this listing.');
    return;
  }

  await loadListings();
}

function showMessage(message) {
  $('#market-list').innerHTML = '';
  $('#market-summary').textContent = '';
  $('#market-message').textContent = message;
  $('#market-message').style.display = 'block';
}

init();

import { renderChrome, $, esc, CATS, PAY, badges, hours, isOpen } from './ui.js';
import { getSessionWithStatus, checkAuthErrorParams } from './auth.js';
import { supabase } from './supabase.js';
import { generateQRCode, generateQRCodeDataURL } from './qrcode.js';
import { createPDFGenerator } from './pdf-generator.js';
import { isSupabaseConfigured } from './auth.js';

const urlParams = new URLSearchParams(window.location.search);
const storeId = urlParams.get('storeId');
const contentEl = $('#standee-content');
const loadingMsg = $('#loading-msg');
const errorMsg = $('#error-msg');
const qrCanvasContainer = $('#qr-canvas-container');
const previewBtn = $('#preview-btn');
const downloadBtn = $('#download-btn');
const standeeMessage = $('#standee-message');

let currentStore = null;
let currentSession = null;
let qrDataUrl = null;
let pdfGenerator = null;
let currentQRCanvas = null;
let mapDataUrl = null; // captured map image

async function init() {
  console.log('[Standee] Initializing...');
  if (!isSupabaseConfigured()) {
    showError('Supabase not configured');
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

  // profile is already from getSessionWithStatus, but fetch if missing
  const currentProfile = profile || await getCachedProfile(session.user.id);
  renderChrome('/standee/', session, currentProfile);

  if (!storeId) {
    // Fallback: try to find store owned by current user
    console.log('[Standee] No storeId in URL, looking up user store...');
    const { data: userStore, error: userStoreError } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', currentSession.user.id)
      .maybeSingle();

    if (userStoreError || !userStore) {
      showError('No store found for your account');
      return;
    }
    // Use this store's ID
    window.history.replaceState(null, '', `/standee/?storeId=${userStore.id}`);
    await loadStore(userStore.id);
  } else {
    await loadStore();
  }
  await initQRCode();
  bindEvents();
  contentEl.style.display = 'block';
  loadingMsg.style.display = 'none';
  console.log('[Standee] Initialization complete');
}

async function loadStore(explicitStoreId = null) {
  const targetStoreId = explicitStoreId || storeId;
  const { data: store, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', targetStoreId)
    .single();

  if (error || !store) {
    showError('Store not found');
    return;
  }

  // Verify ownership
  if (store.user_id !== currentSession.user.id) {
    showError('You do not own this store');
    return;
  }

  currentStore = store;
  renderStoreInfo();
  await initMapCapture();
}

function renderStoreInfo() {
  const s = currentStore;

  $('#standee-store-name').textContent = s.business_name;
  $('#standee-store-category').textContent = `${CATS[s.trade_category] || s.trade_category} • ${s.barangay}, ${s.purok || '—'}`;

  const addressParts = [
    s.landmark_reference,
    s.barangay,
    s.purok ? `Purok ${s.purok}` : null,
    'Trento, Agusan del Sur'
  ].filter(Boolean).join(', ');

  $('#standee-address').textContent = addressParts;
  $('#standee-hours').textContent = `${hours(s)} • ${isOpen(s) ? 'Open now' : 'Closed'}`;

  const payments = (s.accepted_payments || []).filter(p => Object.prototype.hasOwnProperty.call(PAY, p)).map(p => PAY[p]).join(', ');
  $('#standee-payments').textContent = payments || '—';

  // Storefront image
  if (s.storefront_image_url) {
    const img = $('#standee-storefront');
    img.src = s.storefront_image_url;
    img.style.display = 'block';
  }

  // Badges
  const badgeContainer = $('#standee-badges');
  badgeContainer.innerHTML = badges(s);
}

async function initQRCode() {
  console.log('[Standee] Generating QR code...');
  // Generate QR code for the store's business page
  const businessUrl = `${window.location.origin}/business/?trn=${encodeURIComponent(currentStore.trn_code)}`;
  console.log('[Standee] Business URL:', businessUrl);

  try {
    qrDataUrl = await generateQRCodeDataURL(businessUrl, {
      size: 300,
      margin: 4,
      color: { dark: '#1f4d2e', light: '#ffffff' }
    });
    console.log('[Standee] QR data URL generated, length:', qrDataUrl?.length);

    // Validate QR data URL
    if (!qrDataUrl || !qrDataUrl.startsWith('data:image/')) {
      throw new Error('Invalid QR code data URL generated');
    }

    // Display QR code
    const canvas = await generateQRCode(businessUrl, {
      size: 300,
      margin: 4,
      color: { dark: '#1f4d2e', light: '#ffffff' }
    });
    currentQRCanvas = canvas;
    qrCanvasContainer.innerHTML = '';
    qrCanvasContainer.appendChild(canvas);
    console.log('[Standee] QR code canvas rendered');

    // Initialize PDF generator
    pdfGenerator = await createPDFGenerator('a5', 'portrait');
    console.log('[Standee] PDF generator initialized');
  } catch (err) {
    console.error('QR code generation failed:', err);
    showError('Failed to generate QR code: ' + err.message);
  }
}

// Load Leaflet from CDN
async function loadLeaflet() {
  if (window.L) return;

  await new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="leaflet"]')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  // Load Leaflet CSS
  if (!document.querySelector('link[href*="leaflet.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.crossOrigin = '';
    document.head.appendChild(link);
  }
}

// Initialize and capture map for PDF
async function initMapCapture() {
  const s = currentStore;
  if (!s.lat || !s.lng) {
    console.log('[Standee] No coordinates for map capture');
    return;
  }

  // Create a temporary container - hidden from start
  // Use 16:9 aspect ratio (wider) to better fill the PDF box
  const containerWrapper = document.createElement('div');
  containerWrapper.style.cssText = 'position:fixed;top:0;left:0;width:400px;height:225px;z-index:-1;pointer-events:none;overflow:hidden;opacity:0;visibility:hidden;';
  const mapContainer = document.createElement('div');
  mapContainer.id = 'map-capture';
  mapContainer.style.width = '100%';
  mapContainer.style.height = '100%';
  containerWrapper.appendChild(mapContainer);
  document.body.appendChild(containerWrapper);

  try {
    console.log('[Standee] Initializing map capture...');
    await loadLeaflet();

    // Create map
    const map = L.map(mapContainer, {
      center: [s.lat, s.lng],
      zoom: 18, // Higher zoom = more detail, closer view
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
    });

    // Use MapTiler tiles with API key (CORS enabled)
    L.tileLayer('https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=SDGX4tTeBecuKwo7Vs1s', {
      maxZoom: 20,
      crossOrigin: 'anonymous',
    }).addTo(map);

    // Add marker using a simple approach
    const markerIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="width:24px;height:24px;background:#b91c1c;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"><div style="width:12px;height:12px;background:white;border-radius:50%;margin:6px 0 0 6px;transform:rotate(45deg)"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
    L.marker([s.lat, s.lng], { icon: markerIcon }).addTo(map);

    // Wait for map to initialize and tiles to load
    await new Promise(resolve => {
      map.whenReady(() => {
        map.invalidateSize();
        let tilesLoaded = 0;
        map.on('tileload', () => {
          tilesLoaded++;
          if (tilesLoaded >= 4) resolve();
        });
        setTimeout(resolve, 5000); // fallback
      });
    });

    // Extra render time
    await new Promise(r => setTimeout(r, 500));

    // Capture map as image
    const canvas = document.createElement('canvas');
    const mapSize = map.getSize();
    canvas.width = mapSize.x;
    canvas.height = mapSize.y;
    const ctx = canvas.getContext('2d');

    console.log('[Standee] Map size:', mapSize.x, 'x', mapSize.y);

    // Draw tile layer
    const tilePane = mapContainer.querySelector('.leaflet-tile-pane');
    if (tilePane) {
      const tiles = tilePane.querySelectorAll('img');
      console.log('[Standee] Found tiles:', tiles.length);
      for (const tile of tiles) {
        if (tile.complete && tile.naturalWidth > 0) {
          const rect = tile.getBoundingClientRect();
          const mapRect = mapContainer.getBoundingClientRect();
          ctx.drawImage(
            tile,
            rect.left - mapRect.left,
            rect.top - mapRect.top,
            rect.width,
            rect.height
          );
        }
      }
    }

    // Draw marker at calculated position
    const markerEl = mapContainer.querySelector('.custom-marker');
    if (markerEl) {
      const rect = markerEl.getBoundingClientRect();
      const mapRect = mapContainer.getBoundingClientRect();
      console.log('[Standee] Marker rect:', rect);
      console.log('[Standee] Map rect:', mapRect);

      const cx = rect.left - mapRect.left + rect.width / 2;
      const cy = rect.top - mapRect.top + rect.height;

      // Draw pin
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy - 12, 12, Math.PI * 0.2, Math.PI * 1.8);
      ctx.closePath();
      ctx.fill();

      // White center
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(cx, cy - 12, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Fallback: draw marker at map center
      const centerX = mapSize.x / 2;
      const centerY = mapSize.y / 2 + 12;
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY - 12, 12, Math.PI * 0.2, Math.PI * 1.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(centerX, centerY - 12, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    mapDataUrl = canvas.toDataURL('image/png');
    console.log('[Standee] Map captured, data URL length:', mapDataUrl.length, 'starts with data:image:', mapDataUrl.startsWith('data:image/'));

    map.remove();
  } catch (e) {
    console.error('[Standee] Map capture failed:', e);
    mapDataUrl = null;
  } finally {
    // Clean up temporary container
    if (containerWrapper.parentNode) {
      containerWrapper.parentNode.removeChild(containerWrapper);
    }
  }
}

function bindEvents() {
  // Format options
  const formatRadios = document.querySelectorAll('input[name="format"]');
  const orientationRadios = document.querySelectorAll('input[name="orientation"]');

  formatRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (pdfGenerator) {
        pdfGenerator = null; // Will be recreated with new format
      }
    });
  });

  orientationRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (pdfGenerator) {
        pdfGenerator = null;
      }
    });
  });

  // Preview button
  previewBtn?.addEventListener('click', async () => {
    await generateAndPreviewPDF();
  });

  // Download button
  downloadBtn?.addEventListener('click', async () => {
    await generateAndDownloadPDF();
  });
}

async function generateAndPreviewPDF() {
  if (!currentStore) {
    showError('Store data not loaded');
    return;
  }

  const format = document.querySelector('input[name="format"]:checked').value;
  const orientation = document.querySelector('input[name="orientation"]:checked').value;
  const includeMap = document.getElementById('includeMap').checked;
  const includeHours = document.getElementById('includeHours').checked;
  const includePayments = document.getElementById('includePayments').checked;
  const includeBadges = document.getElementById('includeBadges').checked;

  try {
    console.log('[Standee] Generating preview PDF:', { format, orientation });
    showMessage('Generating PDF...', 'info');
    downloadBtn.disabled = true;
    previewBtn.disabled = true;

    // Reinitialize PDF generator with selected format
    pdfGenerator = await createPDFGenerator(format, orientation);

    const blob = await generatePDF({
      includeMap,
      includeHours,
      includePayments,
      includeBadges
    });

    // Open preview in new tab
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');

    showMessage('PDF generated successfully!', 'ok');
  } catch (err) {
    console.error('PDF generation failed:', err);
    showError('Failed to generate PDF: ' + err.message);
  } finally {
    downloadBtn.disabled = false;
    previewBtn.disabled = false;
  }
}

async function generateAndDownloadPDF() {
  if (!currentStore) {
    showError('Store data not loaded');
    return;
  }

  const format = document.querySelector('input[name="format"]:checked').value;
  const orientation = document.querySelector('input[name="orientation"]:checked').value;
  const includeMap = document.getElementById('includeMap').checked;
  const includeHours = document.getElementById('includeHours').checked;
  const includePayments = document.getElementById('includePayments').checked;
  const includeBadges = document.getElementById('includeBadges').checked;

  try {
    console.log('[Standee] Generating download PDF:', { format, orientation });
    showMessage('Generating PDF...', 'info');
    downloadBtn.disabled = true;
    previewBtn.disabled = true;

    // Reinitialize PDF generator with selected format
    pdfGenerator = await createPDFGenerator(format, orientation);

    const blob = await generatePDF({
      includeMap,
      includeHours,
      includePayments,
      includeBadges
    });

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `standee-${currentStore.trn_code}-${format}-${orientation}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMessage('PDF downloaded successfully!', 'ok');
  } catch (err) {
    console.error('PDF generation failed:', err);
    showError('Failed to generate PDF: ' + err.message);
  } finally {
    downloadBtn.disabled = false;
    previewBtn.disabled = false;
  }
}

async function generatePDF(options) {
  const { includeMap, includeHours, includePayments, includeBadges } = options;
  const s = currentStore;

  const pdf = pdfGenerator.doc;
  const pageWidth = pdfGenerator.pageWidth;
  const pageHeight = pdfGenerator.pageHeight;
  const isLandscape = pageWidth > pageHeight;
  const isA5 = Math.min(pageWidth, pageHeight) <= 160;
  const scale = isA5 ? 0.78 : 1.0;

  const margin = isA5 ? 8 : 11;
  const contentWidth = pageWidth - 2 * margin;

  // Color palette (PaliTrento Forest Green + Warm Amber Gold + Ivory Cream)
  const C = {
    cream: '#FAF7F0',
    card: '#FFFFFF',
    forest: '#1B4329',
    forestDark: '#122D1C',
    forestSoft: '#EAF3ED',
    amber: '#F0A030',
    amberSoft: '#FFF5E5',
    ink: '#141D17',
    muted: '#5B675F',
    line: '#E2DDD2',
    white: '#FFFFFF',
  };

  // Helper: draw decorative QR corner brackets
  function drawCornerBrackets(x, y, size, arm, lineWidth, color) {
    pdf.setDrawColor(color);
    pdf.setLineWidth(lineWidth);
    // Top-left
    pdf.line(x, y + arm, x, y);
    pdf.line(x, y, x + arm, y);
    // Top-right
    pdf.line(x + size - arm, y, x + size, y);
    pdf.line(x + size, y, x + size, y + arm);
    // Bottom-left
    pdf.line(x, y + size - arm, x, y + size);
    pdf.line(x, y + size, x + arm, y + size);
    // Bottom-right
    pdf.line(x + size - arm, y + size, x + size, y + size);
    pdf.line(x + size, y + size, x + size, y + size - arm);
  }

  // Helper: clean address string without duplicate "Trento"
  function buildAddressText() {
    const rawParts = [
      s.landmark_reference,
      s.purok ? `Purok ${s.purok}` : null,
      s.barangay,
      'Trento, Agusan del Sur',
    ]
      .map(v => (v ? String(v).trim() : ''))
      .filter(Boolean);
    const deduped = [];
    for (const part of rawParts) {
      const low = part.toLowerCase();
      const covered = deduped.some(ex => {
        const exLow = ex.toLowerCase();
        return exLow.includes(low) || (low.includes('trento') && exLow.includes('trento'));
      });
      if (!covered) deduped.push(part);
    }
    return deduped.join(', ') || 'Trento, Agusan del Sur';
  }

  // Helper: build detail rows based on user checkboxes
  const detailRows = [{ label: 'ADDRESS', value: buildAddressText() }];
  if (includeHours) {
    detailRows.push({ label: 'HOURS', value: `${hours(s)} (Daily)` });
  }
  if (includePayments) {
    const payments = (s.accepted_payments || [])
      .filter(p => Object.prototype.hasOwnProperty.call(PAY, p))
      .map(p => PAY[p])
      .join('  •  ');
    detailRows.push({ label: 'PAYMENTS', value: payments || 'Cash' });
  }
  if (s.contact_number) {
    detailRows.push({ label: 'CONTACT', value: String(s.contact_number).trim() });
  }

  // Badges list (WinAnsi-safe text for jsPDF Helvetica)
  const storeBadges = [];
  if (includeBadges) {
    if (s.verification_status === 'VERIFIED' || s.approval_status === 'APPROVED') {
      storeBadges.push({ text: 'VERIFIED STORE', bg: '#DCFCE7', textColor: '#14532D', border: '#A7E8BE' });
    }
    if (s.dti_registered) {
      storeBadges.push({ text: 'DTI REGISTERED', bg: '#E0F2FE', textColor: '#0369A1', border: '#BAE6FD' });
    }
    if (s.bmbe_registered) {
      storeBadges.push({ text: 'BMBE', bg: '#E0F2FE', textColor: '#0369A1', border: '#BAE6FD' });
    }
    if (s.srp_compliant) {
      storeBadges.push({ text: 'SRP COMPLIANT', bg: '#FEF3C7', textColor: '#92400E', border: '#FDE68A' });
    }
  }

  const businessUrl = `${window.location.origin}/business/?trn=${encodeURIComponent(s.trn_code)}`;
  const shortDisplayUrl = businessUrl.replace(/^https?:\/\//, '');

  // Load brand logo once
  let logoDataUrl = '';
  try {
    const logoResponse = await fetch('/logo.png');
    const logoBlob = await logoResponse.blob();
    logoDataUrl = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(logoBlob);
    });
  } catch (e) {
    console.warn('Could not load logo for PDF:', e);
  }

  // ===== 1. WARM IVORY PAGE BACKGROUND + SUBTLE FRAME =====
  pdfGenerator.addRect(0, 0, pageWidth, pageHeight, { color: C.cream });

  // ===== 2. BRANDED FOREST-GREEN HEADER + GOLD ACCENT STRIPE =====
  const headerH = isLandscape ? (isA5 ? 21 : 26) : (isA5 ? 25 : 31);
  pdfGenerator.addRect(0, 0, pageWidth, headerH, { color: C.forest });
  // Subtle darker right accent block for depth
  pdfGenerator.addRect(pageWidth * 0.68, 0, pageWidth * 0.32, headerH, { color: C.forestDark });
  // Warm amber-gold bar under header
  const goldBarH = isA5 ? 1.8 : 2.4;
  pdfGenerator.addRect(0, headerH, pageWidth, goldBarH, { color: C.amber });

  // White rounded logo tile on left
  const logoTileSize = headerH * 0.64;
  const logoTileY = (headerH - logoTileSize) / 2;
  pdfGenerator.addRoundedRect(margin, logoTileY, logoTileSize, logoTileSize, 2.5, {
    fillColor: C.cream,
  });
  if (logoDataUrl) {
    try {
      const pad = logoTileSize * 0.14;
      pdf.addImage(
        logoDataUrl,
        'PNG',
        margin + pad,
        logoTileY + pad,
        logoTileSize - pad * 2,
        logoTileSize - pad * 2
      );
    } catch (e) {
      console.warn('Could not add logo to PDF:', e);
    }
  }

  // Brand wordmark ("Pali" cream + "Trento" gold)
  const brandX = margin + logoTileSize + (isA5 ? 3.5 : 4.5);
  const brandFontSize = isLandscape ? (isA5 ? 14 : 17) : (isA5 ? 15.5 : 19);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(brandFontSize);
  pdf.setTextColor('#FEF3E2');
  const brandY = headerH * 0.48;
  pdf.text('Pali', brandX, brandY);
  const paliW = pdf.getTextWidth('Pali');
  pdf.setTextColor('#FBC14E');
  pdf.text('Trento', brandX + paliW, brandY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(isA5 ? 6.8 : 8);
  pdf.setTextColor('#D8E8DD');
  pdf.text('Tara, Palit Ta sa Trento!', brandX, headerH * 0.74);

  // Right side TRN pill badge
  const trnLabel = `TRN: ${s.trn_code}`;
  const trnFontSize = isA5 ? 7 : 8.5;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(trnFontSize);
  const trnW = pdf.getTextWidth(trnLabel) + (isA5 ? 7 : 9);
  const trnH = isA5 ? 6.5 : 8;
  const trnX = pageWidth - margin - trnW;
  const trnY = headerH * 0.22;
  pdfGenerator.addRoundedRect(trnX, trnY, trnW, trnH, 2.5, {
    fillColor: C.forest,
    strokeColor: '#FBC14E',
    lineWidth: 0.35,
  });
  pdf.setTextColor('#FBC14E');
  pdf.text(trnLabel, trnX + trnW / 2, trnY + trnH * 0.68, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(isA5 ? 5.6 : 6.6);
  pdf.setTextColor('#CFE0D5');
  pdf.text('OFFICIAL LOCAL MERCHANT', pageWidth - margin, headerH * 0.80, { align: 'right' });

  // ===== 3. SOLID BRANDED FOOTER BAR =====
  const footerH = isLandscape ? (isA5 ? 11 : 13) : (isA5 ? 13 : 16);
  const footerTopY = pageHeight - footerH;
  pdfGenerator.addRect(0, footerTopY - 1, pageWidth, 1, { color: C.amber });
  pdfGenerator.addRect(0, footerTopY, pageWidth, footerH, { color: C.forest });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(isA5 ? 7 : 8.5);
  pdf.setTextColor('#FEF3E2');
  pdf.text(
    'PaliTrento  •  Municipality of Trento, Agusan del Sur',
    margin,
    footerTopY + footerH * 0.62
  );
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(isA5 ? 6.5 : 7.8);
  pdf.setTextColor('#FBC14E');
  pdf.text('palitrento.online', pageWidth - margin, footerTopY + footerH * 0.62, { align: 'right' });

  // Inner workspace area between header and footer
  const workTop = headerH + goldBarH + (isA5 ? 4.5 : 6);
  const workBottom = footerTopY - (isA5 ? 4.5 : 6);
  const workH = workBottom - workTop;

  // Helper: render centered badges row inside a box
  function drawCenteredBadges(cx, y, maxW, fontSize) {
    if (storeBadges.length === 0) return y;
    const padX = isA5 ? 2.6 : 3.2;
    const padY = isA5 ? 1.0 : 1.3;
    const gap = isA5 ? 2 : 2.6;
    const widths = storeBadges.map(b => pdfGenerator.measureBadgeWidth(b.text, { fontSize, paddingX: padX }));
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (storeBadges.length - 1);
    let bx = Math.max(cx - maxW / 2, cx - totalW / 2);
    let maxH = 0;
    storeBadges.forEach((b, idx) => {
      if (bx + widths[idx] > cx + maxW / 2) return;
      const res = pdfGenerator.addBadge(b.text, bx, y, {
        fontSize,
        paddingX: padX,
        paddingY: padY,
        backgroundColor: b.bg,
        textColor: b.textColor,
        borderColor: b.border,
        borderRadius: 2,
      });
      bx += res.width + gap;
      maxH = Math.max(maxH, res.height);
    });
    return y + maxH;
  }

  // Helper: render map box cleanly inside (x, y, w, h)
  function drawMapCard(x, y, w, h) {
    pdfGenerator.addRoundedRect(x, y, w, h, 3, {
      fillColor: C.card,
      strokeColor: C.line,
      lineWidth: 0.35,
    });
    const capH = isA5 ? 5.5 : 6.8;
    pdfGenerator.addRoundedRect(x, y, w, capH, 2.5, { fillColor: C.forestSoft });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(isA5 ? 6.2 : 7.2);
    pdf.setTextColor(C.forest);
    pdf.text('STORE LOCATION', x + 3, y + capH * 0.68);

    const imgX = x + 2;
    const imgY = y + capH + 1.5;
    const imgW = w - 4;
    const imgH = Math.max(8, h - capH - 3.5);

    if (mapDataUrl && mapDataUrl.startsWith('data:image/')) {
      try {
        pdf.addImage(mapDataUrl, 'PNG', imgX, imgY, imgW, imgH);
        pdf.setDrawColor(C.line);
        pdf.setLineWidth(0.25);
        pdf.rect(imgX, imgY, imgW, imgH, 'S');
        return;
      } catch (imgErr) {
        console.warn('[Standee] Failed to add captured map to PDF:', imgErr);
      }
    }

    // Clean vector pin fallback (no garbled emoji!)
    pdfGenerator.addRect(imgX, imgY, imgW, imgH, { color: '#F3EFE6', strokeColor: C.line, lineWidth: 0.25 });
    const pinCx = imgX + imgW / 2;
    const pinCy = imgY + imgH * 0.38;
    pdf.setFillColor(C.forest);
    pdf.circle(pinCx, pinCy, isA5 ? 2.6 : 3.2, 'F');
    pdf.setFillColor(C.amber);
    pdf.circle(pinCx, pinCy, isA5 ? 1.1 : 1.4, 'F');
    pdfGenerator.addText(
      `${s.barangay || 'Trento'}, Agusan del Sur`,
      pinCx,
      imgY + imgH * 0.68,
      { fontSize: isA5 ? 6.8 : 8, fontStyle: 'bold', color: C.forest, align: 'center', maxWidth: imgW - 4 }
    );
    if (s.lat && s.lng) {
      pdfGenerator.addText(
        `${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`,
        pinCx,
        imgY + imgH * 0.84,
        { fontSize: isA5 ? 5.6 : 6.6, color: C.muted, align: 'center', maxWidth: imgW - 4 }
      );
    }
  }

  // Helper: render details card cleanly inside (x, y, w, h)
  function drawDetailsCard(x, y, w, h, twoCol = false) {
    pdfGenerator.addRoundedRect(x, y, w, h, 3, {
      fillColor: C.card,
      strokeColor: C.line,
      lineWidth: 0.35,
    });
    const capH = isA5 ? 5.5 : 6.8;
    pdfGenerator.addRoundedRect(x, y, w, capH, 2.5, { fillColor: C.forestSoft });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(isA5 ? 6.2 : 7.2);
    pdf.setTextColor(C.forest);
    pdf.text('STORE INFORMATION', x + 3.5, y + capH * 0.68);

    const padX = isA5 ? 3.5 : 4.5;
    const innerTop = y + capH + (isA5 ? 4 : 5);
    const labelSize = isA5 ? 6 : 7;
    const valSize = isA5 ? 7.6 : 9;

    if (twoCol && detailRows.length >= 2) {
      const colW = (w - padX * 3) / 2;
      const leftRows = detailRows.filter((_, i) => i % 2 === 0);
      const rightRows = detailRows.filter((_, i) => i % 2 === 1);
      [
        { rows: leftRows, colX: x + padX },
        { rows: rightRows, colX: x + padX * 2 + colW },
      ].forEach(({ rows, colX }) => {
        let ry = innerTop;
        rows.forEach((row, idx) => {
          if (ry > y + h - 4) return;
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(labelSize);
          pdf.setTextColor(C.forest);
          pdf.text(row.label, colX, ry);
          ry += isA5 ? 3.2 : 4;
          ry = pdfGenerator.addText(row.value, colX, ry, {
            fontSize: valSize,
            color: C.ink,
            maxWidth: colW,
            lineHeight: 1.25,
          });
          if (idx < rows.length - 1) ry += isA5 ? 2 : 3;
        });
      });
    } else {
      let ry = innerTop;
      const availW = w - padX * 2;
      detailRows.forEach((row, idx) => {
        if (ry > y + h - 4) return;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(labelSize);
        pdf.setTextColor(C.forest);
        pdf.text(row.label, x + padX, ry);
        ry += isA5 ? 3.1 : 3.8;
        ry = pdfGenerator.addText(row.value, x + padX, ry, {
          fontSize: valSize,
          color: C.ink,
          maxWidth: availW,
          lineHeight: 1.22,
        });
        if (idx < detailRows.length - 1 && ry < y + h - 5) {
          ry += isA5 ? 1.2 : 1.8;
          pdfGenerator.addLine(x + padX, ry, x + w - padX, ry, { color: '#EFECE5', width: 0.25 });
          ry += isA5 ? 3.2 : 4;
        }
      });
    }
  }

  // Helper: render full QR Showcase Card inside (x, y, w, h)
  function drawQrShowcaseCard(x, y, w, h) {
    pdfGenerator.addRoundedRect(x, y, w, h, 4, {
      fillColor: C.card,
      strokeColor: C.forest,
      lineWidth: 0.55,
    });

    // Top green callout banner inside QR card
    const bannerH = isA5 ? 9 : 11.5;
    pdfGenerator.addRoundedRect(x, y, w, bannerH, 3.5, { fillColor: C.forest });
    // Square off bottom corners of the banner
    pdfGenerator.addRect(x, y + bannerH - 3, w, 3, { color: C.forest });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(isA5 ? 8.5 : 10.5);
    pdf.setTextColor('#FEF3E2');
    pdf.text('SCAN TO BROWSE PRICES & RESERVE', x + w / 2, y + bannerH * 0.65, { align: 'center' });

    // Bottom section reserved for 3-step guide + URL pill
    const stepsH = isA5 ? 12 : 15;
    const innerTop = y + bannerH + (isA5 ? 4 : 5.5);
    const innerBottom = y + h - stepsH - (isA5 ? 3 : 4);
    const availH = Math.max(20, innerBottom - innerTop);
    const availW = w - (isA5 ? 12 : 16);
    const qrSize = Math.min(availH, availW, isA5 ? 68 : 96);

    if (qrSize < 18) {
      throw new Error('There is not enough space for the QR code. Try A4 or uncheck an optional section.');
    }

    const qrX = x + (w - qrSize) / 2;
    const qrY = innerTop + (availH - qrSize) / 2;
    const framePad = isA5 ? 2.4 : 3.2;

    // Subtle soft frame behind QR + decorative corner brackets
    pdfGenerator.addRoundedRect(
      qrX - framePad,
      qrY - framePad,
      qrSize + framePad * 2,
      qrSize + framePad * 2,
      3,
      { fillColor: C.white, strokeColor: C.line, lineWidth: 0.25 }
    );
    drawCornerBrackets(
      qrX - framePad,
      qrY - framePad,
      qrSize + framePad * 2,
      Math.min(8, qrSize * 0.16),
      isA5 ? 0.9 : 1.15,
      C.forest
    );

    if (qrDataUrl) {
      pdfGenerator.addQRCode(qrDataUrl, qrX, qrY, qrSize);
    }

    // 3-step quick guide
    const stepY = y + h - stepsH + (isA5 ? 2.5 : 3.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(isA5 ? 6.4 : 7.8);
    pdf.setTextColor(C.forest);
    pdf.text(
      '1. Open Camera   •   2. Scan QR   •   3. View Live Prices',
      x + w / 2,
      stepY,
      { align: 'center' }
    );

    // URL pill
    const urlY = stepY + (isA5 ? 2.4 : 3.2);
    const urlFont = isA5 ? 6 : 7.2;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(urlFont);
    const pillW = Math.min(w - 8, pdf.getTextWidth(shortDisplayUrl) + 8);
    const pillH = isA5 ? 5 : 6.2;
    pdfGenerator.addRoundedRect(x + (w - pillW) / 2, urlY, pillW, pillH, 2.2, {
      fillColor: C.forestSoft,
    });
    pdf.setTextColor(C.forestDark);
    pdf.text(shortDisplayUrl, x + w / 2, urlY + pillH * 0.68, { align: 'center' });
  }

  // ===== 4. ADAPTIVE LAYOUT: LANDSCAPE (2-COLUMN) vs PORTRAIT (STACKED CARDS) =====
  if (isLandscape) {
    const gap = isA5 ? 5 : 6.5;
    const leftW = contentWidth * 0.54;
    const rightW = contentWidth - leftW - gap;
    const rightX = margin + leftW + gap;

    // Right column: full-height QR Showcase Card
    drawQrShowcaseCard(rightX, workTop, rightW, workH);

    // Left column top: Store Identity Card
    const hasBadges = storeBadges.length > 0;
    const idCardH = (hasBadges ? 34 : 26) * scale;
    pdfGenerator.addRoundedRect(margin, workTop, leftW, idCardH, 3.5, {
      fillColor: C.card,
      strokeColor: C.line,
      lineWidth: 0.35,
    });
    // Left amber vertical accent bar
    pdfGenerator.addRoundedRect(margin, workTop, 2.2, idCardH, 1, { fillColor: C.amber });

    let ly = workTop + (isA5 ? 6.5 : 8);
    ly = pdfGenerator.addText(s.business_name, margin + 5.5, ly, {
      fontSize: isA5 ? 14 : 18,
      fontStyle: 'bold',
      color: C.forest,
      maxWidth: leftW - 9,
      lineHeight: 1.15,
    });
    ly = pdfGenerator.addText(
      `${CATS[s.trade_category] || s.trade_category}  •  ${s.barangay}${s.purok ? `, Purok ${s.purok}` : ''}`,
      margin + 5.5,
      ly + 0.5,
      { fontSize: isA5 ? 7.5 : 9, color: C.muted, maxWidth: leftW - 9 }
    );
    if (hasBadges) {
      drawCenteredBadges(margin + leftW / 2 + 1, ly + 1, leftW - 10, isA5 ? 5.6 : 6.5);
    }

    // Left column bottom: Details + optional Map filling ALL remaining vertical height
    const remTop = workTop + idCardH + (isA5 ? 3.5 : 4.5);
    const remH = Math.max(24, workBottom - remTop);
    if (includeMap) {
      const infoH = remH * 0.52;
      const mapH = remH - infoH - (isA5 ? 3 : 4);
      drawDetailsCard(margin, remTop, leftW, infoH, false);
      drawMapCard(margin, remTop + infoH + (isA5 ? 3 : 4), leftW, mapH);
    } else {
      drawDetailsCard(margin, remTop, leftW, remH, false);
    }
  } else {
    // ===== PORTRAIT LAYOUT (ZERO DEAD SPACE ON A5 & A4!) =====
    const sectionGap = isA5 ? 4 : 5.5;

    // A. Hero Store Identity Card (centered typography + badges)
    const nameFontSize = s.business_name.length > 26 ? (isA5 ? 15 : 19) : (isA5 ? 17.5 : 22);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(nameFontSize);
    const nameLines = pdf.splitTextToSize(s.business_name, contentWidth - 12);
    const nameBlockH = nameLines.length * (nameFontSize * 25.4 / 72) * 1.18;
    const hasBadges = storeBadges.length > 0;
    const idCardH = nameBlockH + (isA5 ? 14 : 18) + (hasBadges ? (isA5 ? 8 : 10) : 0);

    pdfGenerator.addRoundedRect(margin, workTop, contentWidth, idCardH, 3.5, {
      fillColor: C.card,
      strokeColor: C.line,
      lineWidth: 0.35,
    });

    let cy = workTop + (isA5 ? 7.5 : 9.5);
    cy = pdfGenerator.addText(s.business_name, pageWidth / 2, cy, {
      fontSize: nameFontSize,
      fontStyle: 'bold',
      color: C.forest,
      align: 'center',
      maxWidth: contentWidth - 12,
      lineHeight: 1.18,
    });
    cy = pdfGenerator.addText(
      `${CATS[s.trade_category] || s.trade_category}  •  ${s.barangay}${s.purok ? `, Purok ${s.purok}` : ''}`,
      pageWidth / 2,
      cy + 0.5,
      { fontSize: isA5 ? 8.2 : 10, color: C.muted, align: 'center', maxWidth: contentWidth - 12 }
    );
    if (hasBadges) {
      drawCenteredBadges(pageWidth / 2, cy + 1.5, contentWidth - 10, isA5 ? 6 : 7);
    }

    // B. Bottom Info (+ Map) Band — fixed proportional height anchored at workBottom
    const bottomBandH = includeMap
      ? Math.max(isA5 ? 44 : 62, workH * 0.29)
      : Math.max(isA5 ? 32 : 44, Math.min(isA5 ? 42 : 56, workH * 0.22));
    const bottomBandY = workBottom - bottomBandH;

    // C. Centerpiece QR Showcase Card — fills the ENTIRE space between Identity Card & Bottom Band!
    const qrCardTop = workTop + idCardH + sectionGap;
    const qrCardH = bottomBandY - sectionGap - qrCardTop;
    drawQrShowcaseCard(margin, qrCardTop, contentWidth, qrCardH);

    // D. Render Bottom Info + Map Row
    if (includeMap) {
      const colGap = isA5 ? 3.5 : 4.5;
      const infoW = contentWidth * 0.54;
      const mapW = contentWidth - infoW - colGap;
      drawDetailsCard(margin, bottomBandY, infoW, bottomBandH, false);
      drawMapCard(margin + infoW + colGap, bottomBandY, mapW, bottomBandH);
    } else {
      drawDetailsCard(margin, bottomBandY, contentWidth, bottomBandH, true);
    }
  }

  return pdfGenerator.getBlob();
}

function showMessage(text, type) {
  standeeMessage.textContent = text;
  standeeMessage.className = `pill ${type}`;
}

function showError(text) {
  loadingMsg.style.display = 'none';
  errorMsg.style.display = 'block';
  errorMsg.textContent = text;
}

init();
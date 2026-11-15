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

  const { session, profile, redirectPath } = await getSessionWithStatus();
  if (redirectPath) {
    window.location.replace(redirectPath);
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
  // Detect A5 in either orientation (A5 landscape is 210mm wide).
  const isA5 = Math.min(pageWidth, pageHeight) <= 160;
  const margin = isA5 ? 8 : 10;
  const contentWidth = pageWidth - 2 * margin;

  // Footer area: line + 2 lines of text + bottom margin = ~14mm (A5) / 16mm (A4)
  const FOOTER_HEIGHT = isA5 ? 14 : 16;
  const footerY = pageHeight - FOOTER_HEIGHT;
  // Max Y where content can go (leave 4mm gap before footer line)
  const maxContentY = footerY - 4;

  let currentY = margin;

  // ===== HEADER BAR =====
  const headerH = isA5 ? 26 : 32;
  pdfGenerator.addRect(0, 0, pageWidth, headerH, { color: '#1f4d2e' });

  // Load logo image (replaces the "T" in PaliTrento)
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

  // Draw "Pali" text
  pdf.setFontSize(isA5 ? 14 : 16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor('#fef3e2');
  pdf.text('Pali', margin, isA5 ? 14 : 16);

  // Logo replaces the "T" - position it where "T" would be
  const paliWidth = pdf.getTextWidth('Pali');
  const tWidth = pdf.getTextWidth('T');
  const logoX = margin + paliWidth; // exactly where "T" would start
  const logoSize = Math.max(tWidth, isA5 ? 5 : 6); // at least as wide as "T"
  const logoY = isA5 ? 10.5 : 11.5; // vertically centered in header
  if (logoDataUrl) {
    try {
      pdf.addImage(logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
    } catch (e) {
      console.warn('Could not add logo to PDF:', e);
    }
  }

  // Draw "rento" text after where "T" would end (logo replaces T)
  const rentoX = logoX + Math.max(tWidth, logoSize);
  pdf.text('rento', rentoX, isA5 ? 14 : 16);

  pdf.setFontSize(isA5 ? 7 : 8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor('#fef3e2');
  pdf.text('Tara, Palit Ta sa Trento!', margin, isA5 ? 21 : 23);

  pdf.setFontSize(isA5 ? 6.5 : 7.5);
  pdf.setTextColor('#fef3e2');
  pdf.text(`TRN: ${s.trn_code}`, pageWidth - margin, isA5 ? 14 : 16, { align: 'right' });

  currentY = headerH + 5;

  // ===== STORE NAME =====
  currentY = pdfGenerator.addText(s.business_name, margin, currentY, {
    fontSize: isA5 ? 16 : 19,
    fontStyle: 'bold',
    color: '#1f4d2e',
    maxWidth: contentWidth,
    lineHeight: 1.2
  });

  // Category + Barangay
  currentY = pdfGenerator.addText(`${CATS[s.trade_category] || s.trade_category}  •  ${s.barangay}${s.purok ? ', Purok ' + s.purok : ''}`, margin, currentY, {
    fontSize: isA5 ? 8 : 9.5,
    color: '#5b675f',
    maxWidth: contentWidth
  });

  currentY += isA5 ? 1.5 : 2;

  // ===== BADGES =====
  if (includeBadges) {
    const storeBadges = [];
    if (s.verification_status === 'VERIFIED') storeBadges.push({ text: 'Verified', bg: '#dcfce7', textColor: '#14532d' });
    if (s.dti_registered) storeBadges.push({ text: 'DTI', bg: '#e0f2fe', textColor: '#0369a1' });
    if (s.bmbe_registered) storeBadges.push({ text: 'BMBE', bg: '#e0f2fe', textColor: '#0369a1' });
    if (s.srp_compliant) storeBadges.push({ text: 'Price Cap ✓', bg: '#dcfce7', textColor: '#14532d' });

    if (storeBadges.length > 0) {
      let badgeX = margin;
      storeBadges.forEach(badge => {
        pdfGenerator.addBadge(badge.text, badgeX, currentY, {
          fontSize: isA5 ? 5 : 5.5,
          paddingX: isA5 ? 3 : 4,
          paddingY: isA5 ? 1 : 1.5,
          backgroundColor: badge.bg,
          textColor: badge.textColor
        });
        badgeX += pdf.getTextWidth(badge.text) + (isA5 ? 9 : 12);
      });
      currentY += isA5 ? 7 : 9;
    }
  }

  // Thin divider
  pdfGenerator.addLine(margin, currentY, pageWidth - margin, currentY, { color: '#dcdad3', width: 0.4 });
  currentY += isA5 ? 3.5 : 4;

  // ===== DETAIL SECTIONS =====
  // Keep each label and value on the same row. The row height is based on
  // whichever side wraps to more lines, so later sections never collide.
  const labelW = isA5 ? 19 : 23;
  const valX = margin + labelW;
  const valW = contentWidth - labelW;
  const rowGap = isA5 ? 2.2 : 2.8;

  function addDetailRow(label, value) {
    const fontSize = isA5 ? 8 : 8.5;
    const lineHeight = 1.3;
    const labelY = currentY;
    const labelEnd = pdfGenerator.addText(label, margin, labelY, {
      fontSize: 7.5, fontStyle: 'bold', color: '#1f4d2e',
      maxWidth: labelW - 2, lineHeight
    });
    const valueEnd = pdfGenerator.addText(value || '—', valX, labelY, {
      fontSize, maxWidth: valW, lineHeight, color: '#1c2a20'
    });
    currentY = Math.max(labelEnd, valueEnd) + rowGap;
  }

  // --- Address ---
  let addressText = s.landmark_reference || '';
  if (!addressText && s.barangay) {
    const parts = [];
    if (s.barangay) parts.push(s.barangay);
    if (s.purok) parts.push(`Purok ${s.purok}`);
    parts.push('Trento, Agusan del Sur');
    addressText = parts.join(', ');
  } else if (addressText && !addressText.toLowerCase().includes('trento')) {
    addressText += ', Trento, Agusan del Sur';
  }
  addDetailRow('Address', addressText);

  // --- Hours ---
  if (includeHours) {
    addDetailRow('Hours', hours(s) + (isOpen(s) ? ' • Open' : ' • Closed'));
  }

  // --- Payments ---
  if (includePayments) {
    const payments = (s.accepted_payments || [])
      .filter(p => Object.prototype.hasOwnProperty.call(PAY, p))
      .map(p => PAY[p]).join(', ') || '—';
    addDetailRow('Pay', payments);
  }

  // --- Location / Map ---
  if (includeMap) {
    // Label
    currentY = pdfGenerator.addText('Location', margin, currentY, { fontSize: 7.5, fontStyle: 'bold', color: '#1f4d2e' });
    currentY += 1.5;

    // Taller box for better map visibility
    const mapH = isA5 ? 28 : 34; // taller box for more detail
    const mapX = margin;
    const mapW = contentWidth;

    // Use captured map from Leaflet (mapDataUrl is set by initMapCapture)
    if (mapDataUrl && mapDataUrl.startsWith('data:image/')) {
      // Draw the captured map image STRETCHED to fill the entire box
      try {
        pdf.addImage(mapDataUrl, 'PNG', mapX, currentY, mapW, mapH);

        // Border around the box
        pdf.setDrawColor('#dcdad3');
        pdf.setLineWidth(0.4);
        pdf.rect(mapX, currentY, mapW, mapH, 'S');
        console.log('[Standee] Captured map drawn to PDF (stretched to fill box)');
      } catch (imgErr) {
        console.warn('[Standee] Failed to add captured map to PDF:', imgErr);
        mapDataUrl = ''; // force fallback
      }
    }
    if (!mapDataUrl) {
      // Fallback: placeholder box with coordinates
      pdfGenerator.addRect(mapX, currentY, mapW, mapH, { color: '#f6f3ec' });
      pdf.setDrawColor('#dcdad3');
      pdf.setLineWidth(0.4);
      pdf.rect(mapX, currentY, mapW, mapH, 'S');

      // Add a map pin icon + coordinates
      const coordY = currentY + mapH / 2 + (isA5 ? 1 : 1.5);
      pdfGenerator.addText(`📍 Lat: ${s.lat?.toFixed(5) || '—'}, Lng: ${s.lng?.toFixed(5) || '—'}`, pageWidth / 2, coordY, {
        fontSize: isA5 ? 7 : 8,
        color: '#1f4d2e',
        align: 'center'
      });

      // Add note about map
      pdfGenerator.addText('(Map capture unavailable — showing coordinates)', pageWidth / 2, coordY + (isA5 ? 3.5 : 4), {
        fontSize: isA5 ? 5.5 : 6,
        color: '#999',
        align: 'center'
      });
      console.log('[Standee] Using fallback coordinate display');
    }

    // Advance Y to after the map box
    currentY += mapH + (isA5 ? 3 : 4);
  }

  // ===== QR SECTION =====
  // Horizontal divider before QR
  pdfGenerator.addLine(margin, currentY, pageWidth - margin, currentY, { color: '#dcdad3', width: 0.4 });
  currentY += isA5 ? 3 : 4;

  // QR Label
  currentY = pdfGenerator.addText('Scan to view store on PaliTrento', pageWidth / 2, currentY, {
    fontSize: isA5 ? 9 : 10,
    fontStyle: 'bold',
    color: '#1f4d2e',
    align: 'center'
  });
  currentY += isA5 ? 2.5 : 3;

  // QR Code - sized to fit available space
  if (qrDataUrl) {
    const urlAndTaglineReserve = isA5 ? 9 : 10;
    const availableH = Math.max(0, maxContentY - currentY - urlAndTaglineReserve);
    const qrSize = Math.min(isA5 ? 45 : 58, contentWidth * 0.75, availableH);
    if (qrSize >= 20) {
      const qrX = (pageWidth - qrSize) / 2;
      pdfGenerator.addQRCode(qrDataUrl, qrX, currentY, qrSize);
      currentY += qrSize + (isA5 ? 2 : 2.5);
    } else {
      throw new Error('There is not enough space for the QR code. Try A4 portrait or disable the map/hours/payment sections.');
    }
  }

  // URL
  currentY = pdfGenerator.addText(`${window.location.origin}/business/?trn=${encodeURIComponent(s.trn_code)}`, pageWidth / 2, currentY, {
    fontSize: isA5 ? 6.5 : 7,
    color: '#5b675f',
    align: 'center'
  });

  currentY += 1.5;

  // Tagline
  currentY = pdfGenerator.addText('Find us on PaliTrento', pageWidth / 2, currentY, {
    fontSize: isA5 ? 7.5 : 8.5,
    fontStyle: 'bold',
    color: '#1f4d2e',
    align: 'center'
  });

  // ===== FOOTER (always at bottom) =====
  // Divider line
  pdfGenerator.addLine(margin, footerY - 3, pageWidth - margin, footerY - 3, { color: '#dcdad3', width: 0.4 });

  // Footer text lines
  pdfGenerator.addText('PaliTrento  •  Tara, Palit Ta sa Trento!', pageWidth / 2, footerY, {
    fontSize: isA5 ? 6 : 6.5,
    color: '#5b675f',
    align: 'center'
  });

  pdfGenerator.addText('Municipality of Trento, Agusan del Sur', pageWidth / 2, footerY + (isA5 ? 3 : 3.5), {
    fontSize: isA5 ? 5 : 5.5,
    color: '#999',
    align: 'center'
  });

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
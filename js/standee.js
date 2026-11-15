import { renderChrome, $, esc, CATS, PAY, badges, hours, isOpen } from './ui.js';
import { getSession, getCachedProfile } from './auth.js';
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

async function init() {
  console.log('[Standee] Initializing...');
  if (!isSupabaseConfigured()) {
    showError('Supabase not configured');
    return;
  }

  const session = await getSession();
  if (!session) {
    window.location.href = '/login/';
    return;
  }

  currentSession = session;

  let profile = await getCachedProfile(session.user.id);
  renderChrome('/standee/', session, profile);

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
  const margin = 10; // Tighter margin for A5
  const contentWidth = pageWidth - 2 * margin;

  // Footer reserve: line (3) + text1 (4) + gap (1) + text2 (3) + bottom margin (3) = ~14mm
  const FOOTER_HEIGHT = 14;
  const footerY = pageHeight - FOOTER_HEIGHT;
  const maxContentY = footerY - 4; // 4mm gap before footer line

  let currentY = margin;

  // ===== COMPACT HEADER =====
  pdfGenerator.addRect(0, 0, pageWidth, 36, { color: '#1f4d2e' });

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor('#fef3e2');
  pdf.text('PaliTrento', margin, 18);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor('#fef3e2');
  pdf.text('Tara, Palit Ta sa Trento!', margin, 26);

  pdf.setFontSize(8);
  pdf.setTextColor('#fef3e2');
  pdf.text(`TRN: ${s.trn_code}`, pageWidth - margin, 18, { align: 'right' });

  currentY = 42;

  // ===== STORE NAME =====
  currentY = pdfGenerator.addText(s.business_name, margin, currentY, {
    fontSize: 18,
    fontStyle: 'bold',
    color: '#1f4d2e',
    maxWidth: contentWidth,
    lineHeight: 1.15
  });

  currentY += 1;

  // Category + Barangay (inline)
  currentY = pdfGenerator.addText(`${CATS[s.trade_category] || s.trade_category}  •  ${s.barangay}${s.purok ? ', Purok ' + s.purok : ''}`, margin, currentY, {
    fontSize: 9.5,
    color: '#5b675f',
    maxWidth: contentWidth
  });

  currentY += 2;

  // Badges (inline, small)
  if (document.getElementById('includeBadges')?.checked) {
    const storeBadges = [];
    if (s.verification_status === 'VERIFIED') storeBadges.push({ text: 'Verified', bg: '#dcfce7', textColor: '#14532d' });
    if (s.dti_registered) storeBadges.push({ text: 'DTI', bg: '#e0f2fe', textColor: '#0369a1' });
    if (s.bmbe_registered) storeBadges.push({ text: 'BMBE', bg: '#e0f2fe', textColor: '#0369a1' });
    if (s.srp_compliant) storeBadges.push({ text: 'Price Cap ✓', bg: '#dcfce7', textColor: '#14532d' });

    if (storeBadges.length > 0) {
      let badgeX = margin;
      storeBadges.forEach(badge => {
        pdfGenerator.addBadge(badge.text, badgeX, currentY, {
          fontSize: 6,
          paddingX: 4,
          paddingY: 1.5,
          backgroundColor: badge.bg,
          textColor: badge.textColor
        });
        badgeX += pdf.getTextWidth(badge.text) + 14;
      });
      currentY += 10;
    }
  }

  currentY += 2;

  // Thin divider
  pdfGenerator.addLine(margin, currentY, pageWidth - margin, currentY, { color: '#dcdad3', width: 0.5 });
  currentY += 4;

  // ===== DETAILS ROW (two-column layout for space efficiency) =====
  const labelW = 20;
  const valX = margin + labelW;
  const valW = contentWidth - labelW;

  // Address
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

  currentY = pdfGenerator.addText('Address', margin, currentY, { fontSize: 8, fontStyle: 'bold', color: '#1f4d2e' });
  currentY = pdfGenerator.addText(addressText, valX, currentY, {
    fontSize: 8.5,
    maxWidth: valW,
    lineHeight: 1.35,
    color: '#1c2a20'
  }) + 3;

  // Hours
  if (document.getElementById('includeHours')?.checked) {
    currentY = pdfGenerator.addText('Hours', margin, currentY, { fontSize: 8, fontStyle: 'bold', color: '#1f4d2e' });
    currentY = pdfGenerator.addText(hours(currentStore) + (isOpen(currentStore) ? ' • Open' : ' • Closed'), valX, currentY, { fontSize: 8.5, color: '#1c2a20' }) + 3;
  }

  // Payments
  if (document.getElementById('includePayments')?.checked) {
    const payments = (currentStore.accepted_payments || []).filter(p => Object.prototype.hasOwnProperty.call(PAY, p)).map(p => PAY[p]).join(', ') || '—';
    currentY = pdfGenerator.addText('Pay', margin, currentY, { fontSize: 8, fontStyle: 'bold', color: '#1f4d2e' });
    currentY = pdfGenerator.addText(payments, valX, currentY, { fontSize: 8.5, color: '#1c2a20' }) + 3;
  }

  // Map (optional, compact) - using addText so currentY tracks properly
  if (document.getElementById('includeMap')?.checked) {
    currentY = pdfGenerator.addText('Location', margin, currentY, { fontSize: 8, fontStyle: 'bold', color: '#1f4d2e' });
    currentY += 1;

    const mapH = 20;
    const mapX = margin;
    const mapW = contentWidth;

    // Map background with border
    pdfGenerator.addRect(mapX, currentY, mapW, mapH, { color: '#f6f3ec' });
    pdf.setDrawColor('#dcdad3');
    pdf.setLineWidth(0.4);
    pdf.rect(mapX, currentY, mapW, mapH, 'S');

    // Coordinates - use addText for proper Y tracking
    currentY = pdfGenerator.addText(`Lat: ${s.lat?.toFixed(5) || '—'}, Lng: ${s.lng?.toFixed(5) || '—'}`, pageWidth / 2, currentY + mapH / 2 - 2, {
      fontSize: 7.5,
      color: '#999',
      align: 'center'
    }) + 1;

    currentY += 4; // gap after map
  }

  // ===== QR SECTION (fills remaining space, but stops before footer) =====
  // Reserve space for: divider(4) + label(5) + QR(min35) + gap(2) + url(4) + tagline(5) = ~55mm
  const qrReserve = 55;
  if (currentY > maxContentY - qrReserve) {
    currentY = maxContentY - qrReserve;
  }

  pdfGenerator.addLine(margin, currentY, pageWidth - margin, currentY, { color: '#dcdad3', width: 0.5 });
  currentY += 4;

  currentY = pdfGenerator.addText('Scan to view store on PaliTrento', pageWidth / 2, currentY, {
    fontSize: 10,
    fontStyle: 'bold',
    color: '#1f4d2e',
    align: 'center'
  });
  currentY += 3;

  // QR Code - sized to fit available space
  if (qrDataUrl) {
    const availableH = maxContentY - currentY - 10; // leave 10mm for URL + tagline
    const maxQrSize = Math.min(55, contentWidth * 0.7, availableH);
    const qrSize = Math.max(35, maxQrSize);
    const qrX = (pageWidth - qrSize) / 2;
    pdfGenerator.addQRCode(qrDataUrl, qrX, currentY, qrSize);
    currentY += qrSize + 2;
  }

  // URL + tagline
  currentY = pdfGenerator.addText(`${window.location.origin}/business/?trn=${encodeURIComponent(s.trn_code)}`, pageWidth / 2, currentY, {
    fontSize: 7,
    color: '#5b675f',
    align: 'center'
  });

  currentY = pdfGenerator.addText('Find us on PaliTrento', pageWidth / 2, currentY + 1.5, {
    fontSize: 8.5,
    fontStyle: 'bold',
    color: '#1f4d2e',
    align: 'center'
  });

  // ===== FOOTER (fixed at bottom, no overlap) =====
  pdfGenerator.addLine(margin, footerY - 3, pageWidth - margin, footerY - 3, { color: '#dcdad3', width: 0.4 });

  pdfGenerator.addText('PaliTrento  •  Tara, Palit Ta sa Trento!', pageWidth / 2, footerY, {
    fontSize: 6.5,
    color: '#5b675f',
    align: 'center'
  });

  pdfGenerator.addText('Municipality of Trento, Agusan del Sur', pageWidth / 2, footerY + 3.5, {
    fontSize: 5.5,
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
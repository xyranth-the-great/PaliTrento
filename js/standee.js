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
  const margin = pdfGenerator.margin;
  const contentWidth = pdfGenerator.contentWidth;

  // Logo URL for header
  const logoUrl = `${window.location.origin}/logo.png`;

  let currentY = margin;

  // ===== HEADER with Logo Mark =====
  // Green header bar
  pdfGenerator.addRect(0, 0, pageWidth, 50, { color: '#1f4d2e' });

  // Logo mark: "Pali" + logo image + "rento"
  // Since we can't easily embed images in jsPDF header, use text representation
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor('#fef3e2');
  pdf.text('PaliTrento', margin, 22);

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor('#fef3e2');
  pdf.text('Tara, Palit Ta sa Trento!', margin, 33);

  // TRN code on right side of header
  pdf.setFontSize(9);
  pdf.setTextColor('#fef3e2');
  pdf.text(`TRN: ${s.trn_code}`, pageWidth - margin, 22, { align: 'right' });

  currentY = 60;

  // ===== STORE NAME (large, prominent) =====
  currentY = pdfGenerator.addText(s.business_name, margin, currentY, {
    fontSize: 22,
    fontStyle: 'bold',
    color: '#1f4d2e',
    maxWidth: contentWidth,
    lineHeight: 1.2
  });

  currentY += 2;

  // Category + Barangay line
  currentY = pdfGenerator.addText(`${CATS[s.trade_category] || s.trade_category}  •  ${s.barangay}${s.purok ? ', Purok ' + s.purok : ''}`, margin, currentY, {
    fontSize: 11,
    color: '#5b675f',
    maxWidth: contentWidth
  });

  currentY += 4;

  // Badges row
  if (document.getElementById('includeBadges')?.checked) {
    const storeBadges = [];
    if (s.verification_status === 'VERIFIED') storeBadges.push({ text: 'Verified', bg: '#dcfce7', textColor: '#14532d' });
    if (s.dti_registered) storeBadges.push({ text: 'DTI Registered', bg: '#e0f2fe', textColor: '#0369a1' });
    if (s.bmbe_registered) storeBadges.push({ text: 'BMBE', bg: '#e0f2fe', textColor: '#0369a1' });
    if (s.srp_compliant) storeBadges.push({ text: 'Follows Price Caps', bg: '#dcfce7', textColor: '#14532d' });

    if (storeBadges.length > 0) {
      let badgeX = margin;
      storeBadges.forEach(badge => {
        pdfGenerator.addBadge(badge.text, badgeX, currentY, {
          fontSize: 7,
          paddingX: 6,
          paddingY: 2,
          backgroundColor: badge.bg,
          textColor: badge.textColor
        });
        badgeX += pdf.getTextWidth(badge.text) + 20;
      });
      currentY += 14;
    }
  }

  currentY += 4;

  // Divider line
  pdfGenerator.addLine(margin, currentY, pageWidth - margin, currentY, { color: '#dcdad3', width: 0.8 });
  currentY += 8;

  // ===== STORE DETAILS (clean single column) =====

  // Address - use landmark_reference as-is
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

  currentY = pdfGenerator.addText('Address', margin, currentY, { fontSize: 9, fontStyle: 'bold', color: '#1f4d2e' });
  currentY = pdfGenerator.addText(addressText, margin, currentY + 2, {
    fontSize: 9.5,
    maxWidth: contentWidth,
    lineHeight: 1.45,
    color: '#1c2a20'
  }) + 5;

  // Hours
  if (document.getElementById('includeHours')?.checked) {
    currentY = pdfGenerator.addText('Hours', margin, currentY, { fontSize: 9, fontStyle: 'bold', color: '#1f4d2e' });
    currentY = pdfGenerator.addText(hours(currentStore) + (isOpen(currentStore) ? '  •  Open now' : '  •  Closed'), margin, currentY + 2, { fontSize: 9.5, color: '#1c2a20' }) + 5;
  }

  // Payment Methods
  if (document.getElementById('includePayments')?.checked) {
    const payments = (currentStore.accepted_payments || []).filter(p => Object.prototype.hasOwnProperty.call(PAY, p)).map(p => PAY[p]).join(', ') || '—';
    currentY = pdfGenerator.addText('Payments', margin, currentY, { fontSize: 9, fontStyle: 'bold', color: '#1f4d2e' });
    currentY = pdfGenerator.addText(payments, margin, currentY + 2, { fontSize: 9.5, color: '#1c2a20' }) + 5;
  }

  // Map - show actual map snippet or coordinates
  if (document.getElementById('includeMap')?.checked) {
    currentY = pdfGenerator.addText('Location', margin, currentY, { fontSize: 9, fontStyle: 'bold', color: '#1f4d2e' });
    currentY += 3;

    const mapHeight = 28;
    const mapY = currentY;
    const mapX = margin;
    const mapW = contentWidth;

    // Map background
    pdfGenerator.addRect(mapX, mapY, mapW, mapHeight, { color: '#f6f3ec' });

    // Coordinates text centered
    pdf.setFontSize(8);
    pdf.setTextColor('#999');
    pdf.setFont('helvetica', 'normal');
    pdf.text('Map Preview', pageWidth / 2, mapY + mapHeight / 2 - 2, { align: 'center' });
    pdf.text(`Lat: ${s.lat?.toFixed(6) || '—'}, Lng: ${s.lng?.toFixed(6) || '—'}`, pageWidth / 2, mapY + mapHeight / 2 + 5, { align: 'center' });

    // Decorative border
    pdf.setDrawColor('#dcdad3');
    pdf.setLineWidth(0.4);
    pdf.rect(mapX, mapY, mapW, mapHeight, 'S');

    currentY = mapY + mapHeight + 8;
  }

  // Divider before QR
  currentY += 4;
  pdfGenerator.addLine(margin, currentY, pageWidth - margin, currentY, { color: '#dcdad3', width: 0.8 });
  currentY += 10;

  // ===== QR CODE SECTION (centered, prominent) =====
  currentY = pdfGenerator.addText('Scan to View Store on PaliTrento', pageWidth / 2, currentY, {
    fontSize: 12,
    fontStyle: 'bold',
    color: '#1f4d2e',
    align: 'center'
  });
  currentY += 5;

  // QR Code - large for easy scanning
  if (qrDataUrl) {
    const qrSize = Math.min(85, contentWidth * 0.8);
    const qrX = (pageWidth - qrSize) / 2;
    pdfGenerator.addQRCode(qrDataUrl, qrX, currentY, qrSize);
    currentY += qrSize + 5;
  }

  // URL text
  currentY = pdfGenerator.addText(`${window.location.origin}/business/?trn=${encodeURIComponent(s.trn_code)}`, pageWidth / 2, currentY, {
    fontSize: 7.5,
    color: '#5b675f',
    align: 'center'
  });

  currentY += 3;
  currentY = pdfGenerator.addText('Find us on PaliTrento', pageWidth / 2, currentY, {
    fontSize: 10,
    fontStyle: 'bold',
    color: '#1f4d2e',
    align: 'center'
  });

  // ===== FOOTER (fixed at bottom) =====
  const footerY = pageHeight - 18;
  pdfGenerator.addLine(margin, footerY - 4, pageWidth - margin, footerY - 4, { color: '#dcdad3', width: 0.5 });

  pdfGenerator.addText('PaliTrento  •  Tara, Palit Ta sa Trento!', pageWidth / 2, footerY, {
    fontSize: 7.5,
    color: '#5b675f',
    align: 'center'
  });

  pdfGenerator.addText('Local directory for the Municipality of Trento, Agusan del Sur', pageWidth / 2, footerY + 4.5, {
    fontSize: 6.5,
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
import { renderChrome, $, esc, CATS, PAY, peso, badges, hours, isOpen } from './ui.js';
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
      size: 256,
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
      size: 256,
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

  let currentY = margin;

  // ===== HEADER =====
  pdfGenerator.addRect(0, 0, pageWidth, 70, { color: '#1f4d2e' });

  pdf.setFontSize(26);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor('#ffffff');
  pdf.text('PaliTrento', margin, 28);

  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor('#fef3e2');
  pdf.text('Tara, Palit Ta sa Trento!', margin, 40);

  // QR Code on top right (header)
  if (qrDataUrl) {
    pdfGenerator.addQRCode(qrDataUrl, pageWidth - margin - 45, 12, 45);
  }

  currentY = 80;

  // ===== STORE NAME =====
  currentY = pdfGenerator.addText(s.business_name, margin, currentY, {
    fontSize: 20,
    fontStyle: 'bold',
    color: '#1f4d2e',
    maxWidth: contentWidth
  });

  currentY += 3;

  // Category + Barangay
  currentY = pdfGenerator.addText(`${CATS[s.trade_category] || s.trade_category}  •  ${s.barangay}${s.purok ? ', Purok ' + s.purok : ''}`, margin, currentY, {
    fontSize: 11,
    color: '#5b675f',
    maxWidth: contentWidth
  });

  currentY += 6;

  // Badges
  if (document.getElementById('includeBadges')?.checked) {
    const storeBadges = [];
    if (s.verification_status === 'VERIFIED') storeBadges.push('Verified');
    if (s.dti_registered) storeBadges.push('DTI Registered');
    if (s.bmbe_registered) storeBadges.push('BMBE');
    if (s.srp_compliant) storeBadges.push('Follows Price Caps');

    if (storeBadges.length > 0) {
      let badgeX = margin;
      storeBadges.forEach(badge => {
        pdfGenerator.addBadge(badge, badgeX, currentY, { fontSize: 7, paddingX: 5, paddingY: 1.5 });
        badgeX += pdf.getTextWidth(badge) + 18;
      });
      currentY += 14;
    }
  }

  currentY += 6;

  // Divider
  pdfGenerator.addLine(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  // ===== STORE DETAILS (single column flow) =====
  // Address - use landmark_reference as-is (it already contains full address)
  // Don't duplicate barangay/purok if landmark already has them
  let addressText = s.landmark_reference || '';
  if (!addressText && s.barangay) {
    // Fallback if no landmark
    const parts = [];
    if (s.barangay) parts.push(s.barangay);
    if (s.purok) parts.push(`Purok ${s.purok}`);
    parts.push('Trento, Agusan del Sur');
    addressText = parts.join(', ');
  } else if (addressText && !addressText.toLowerCase().includes('trento')) {
    // If landmark doesn't have municipality, append it
    addressText += ', Trento, Agusan del Sur';
  }

  currentY = pdfGenerator.addText('Address:', margin, currentY, { fontSize: 10, fontStyle: 'bold', color: '#1f4d2e' });
  currentY = pdfGenerator.addText(addressText, margin, currentY + 3, {
    fontSize: 10,
    maxWidth: contentWidth,
    lineHeight: 1.4
  }) + 6;

  // Hours
  if (document.getElementById('includeHours')?.checked) {
    currentY = pdfGenerator.addText('Hours:', margin, currentY, { fontSize: 10, fontStyle: 'bold', color: '#1f4d2e' });
    currentY = pdfGenerator.addText(hours(currentStore) + (isOpen(currentStore) ? ' • Open now' : ' • Closed'), margin, currentY + 3, { fontSize: 10 }) + 6;
  }

  // Payment Methods
  if (document.getElementById('includePayments')?.checked) {
    const payments = (currentStore.accepted_payments || []).filter(p => Object.prototype.hasOwnProperty.call(PAY, p)).map(p => PAY[p]).join(', ') || '—';
    currentY = pdfGenerator.addText('Accepted Payments:', margin, currentY, { fontSize: 10, fontStyle: 'bold', color: '#1f4d2e' });
    currentY = pdfGenerator.addText(payments, margin, currentY + 3, { fontSize: 10 }) + 6;
  }

  // Map placeholder
  if (document.getElementById('includeMap')?.checked) {
    currentY = pdfGenerator.addText('Location:', margin, currentY, { fontSize: 10, fontStyle: 'bold', color: '#1f4d2e' });
    currentY += 3;

    const mapHeight = 35;
    pdfGenerator.addRect(margin, currentY, contentWidth, mapHeight, { color: '#f6f3ec' });
    pdf.setFontSize(9);
    pdf.setTextColor('#999');
    pdf.setFont('helvetica', 'normal');
    pdf.text('Map Preview', pageWidth / 2, currentY + mapHeight / 2 + 2, { align: 'center' });
    pdf.text(`Lat: ${s.lat}, Lng: ${s.lng}`, pageWidth / 2, currentY + mapHeight / 2 + 8, { align: 'center' });

    currentY += mapHeight + 8;
  }

  // ===== QR CODE SECTION =====
  currentY += 6;
  pdfGenerator.addLine(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  currentY = pdfGenerator.addText('Scan to View Store', margin, currentY, {
    fontSize: 13,
    fontStyle: 'bold',
    color: '#1f4d2e',
    align: 'center'
  });
  currentY += 6;

  // QR Code - larger for better scanning
  if (qrDataUrl) {
    const qrSize = 70;
    const qrX = (pageWidth - qrSize) / 2;
    pdfGenerator.addQRCode(qrDataUrl, qrX, currentY, qrSize);
    currentY += qrSize + 6;
  }

  currentY = pdfGenerator.addText(`business.html?trn=${encodeURIComponent(currentStore.trn_code)}`, pageWidth / 2, currentY, {
    fontSize: 8,
    color: '#5b675f',
    align: 'center'
  });

  currentY = pdfGenerator.addText('Find us on PaliTrento', pageWidth / 2, currentY + 4, {
    fontSize: 10,
    fontStyle: 'bold',
    color: '#1f4d2e',
    align: 'center'
  });

  // ===== FOOTER (fixed at bottom) =====
  const footerY = pageHeight - 22;
  pdfGenerator.addLine(margin, footerY - 5, pageWidth - margin, footerY - 5);

  pdfGenerator.addText('PaliTrento — Tara, Palit Ta sa Trento!', pageWidth / 2, footerY, {
    fontSize: 8,
    color: '#5b675f',
    align: 'center'
  });

  pdfGenerator.addText('A local directory for the Municipality of Trento, Agusan del Sur', pageWidth / 2, footerY + 5, {
    fontSize: 7,
    color: '#5b675f',
    align: 'center'
  });

  currentY = pdfGenerator.addText('A local directory for the Municipality of Trento, Agusan del Sur', pageWidth / 2, currentY, {
    fontSize: 8,
    color: '#5b675f',
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
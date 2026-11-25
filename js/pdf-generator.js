// PDF Generator Utility for QR Standee
// Uses jsPDF (loaded via CDN)

class PDFGenerator {
  constructor() {
    this.doc = null;
    this.pageWidth = 210; // A4 width in mm
    this.pageHeight = 297; // A4 height in mm
    this.margin = 15;
    this.contentWidth = this.pageWidth - 2 * this.margin;
    this._jsPDFLoaded = false;
  }

  async init(format = 'a4', orientation = 'portrait') {
    // Load jsPDF from CDN if not available
    if (!this._jsPDFLoaded) {
      await this._loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      this._jsPDFLoaded = true;
    }

    // Verify jsPDF is available
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
      throw new Error('jsPDF failed to load from CDN');
    }

    const { jsPDF } = window.jspdf;
    this.doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: format
    });

    if (format === 'a4') {
      this.pageWidth = 210;
      this.pageHeight = 297;
    } else if (format === 'a5') {
      this.pageWidth = 148;
      this.pageHeight = 210;
    } else {
      // Default to A4
      this.pageWidth = 210;
      this.pageHeight = 297;
    }

    // Handle orientation
    if (orientation === 'landscape') {
      // Swap width/height for landscape
      const temp = this.pageWidth;
      this.pageWidth = this.pageHeight;
      this.pageHeight = temp;
    }

    this.contentWidth = this.pageWidth - 2 * this.margin;
    console.log(`PDF Generator initialized: ${format} ${orientation}, ${this.pageWidth}x${this.pageHeight}mm`);
    return this;
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        console.log('jsPDF loaded from CDN');
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  // Add QR code to PDF
  addQRCode(qrDataUrl, x, y, size) {
    if (!qrDataUrl || !qrDataUrl.startsWith('data:image/')) {
      console.warn('Invalid QR code data URL, skipping QR code');
      return;
    }
    try {
      this.doc.addImage(qrDataUrl, 'PNG', x, y, size, size);
    } catch (err) {
      console.error('Failed to add QR code to PDF:', err);
      // Draw a placeholder rectangle instead
      this.doc.setFillColor('#e0e0e0');
      this.doc.rect(x, y, size, size, 'F');
      this.doc.setFontSize(8);
      this.doc.setTextColor('#999');
      this.doc.text('QR Code', x + size/2, y + size/2, { align: 'center', baseline: 'middle' });
    }
  }

  // Add text with wrapping
  addText(text, x, y, options = {}) {
    const {
      fontSize = 12,
      fontStyle = 'normal',
      color = '#1f4d2e',
      align = 'left',
      maxWidth = this.contentWidth,
      lineHeight = 1.4
    } = options;

    if (!text) return y;

    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', fontStyle);
    this.doc.setTextColor(color);

    const lines = this.doc.splitTextToSize(text, maxWidth);
    let currentY = y;
    const startX = typeof x === 'number' ? x : this.margin;
    const textAlign = align === 'center' || align === 'right' ? align : 'left';

    lines.forEach((line) => {
      this.doc.text(line, startX, currentY, { align: textAlign });
      // jsPDF font sizes are points, while document coordinates are millimeters.
      // Convert points to mm before advancing the baseline to avoid oversized gaps.
      currentY += (fontSize * 25.4 / 72) * lineHeight;
    });

    return currentY;
  }

  // Add a line
  addLine(x1, y1, x2, y2, options = {}) {
    const { color = '#dcdad3', width = 0.5 } = options;
    this.doc.setDrawColor(color);
    this.doc.setLineWidth(width);
    this.doc.line(x1, y1, x2, y2);
  }

  // Add rectangle
  addRect(x, y, width, height, options = {}) {
    const { color = '#f6f3ec', fill = true, strokeColor = null, lineWidth = 0.35 } = options;
    if (fill) {
      this.doc.setFillColor(color);
    }
    if (strokeColor) {
      this.doc.setDrawColor(strokeColor);
      this.doc.setLineWidth(lineWidth);
    }
    const mode = fill && strokeColor ? 'FD' : fill ? 'F' : 'S';
    this.doc.rect(x, y, width, height, mode);
  }

  // Add rounded rectangle
  addRoundedRect(x, y, width, height, radius = 3, options = {}) {
    const { fillColor = null, strokeColor = null, lineWidth = 0.35 } = options;
    if (fillColor) this.doc.setFillColor(fillColor);
    if (strokeColor) {
      this.doc.setDrawColor(strokeColor);
      this.doc.setLineWidth(lineWidth);
    }
    const mode = fillColor && strokeColor ? 'FD' : fillColor ? 'F' : 'S';
    if (typeof this.doc.roundedRect === 'function') {
      this.doc.roundedRect(x, y, width, height, radius, radius, mode);
    } else {
      this.doc.rect(x, y, width, height, mode);
    }
  }

  // Measure badge width without drawing (in mm)
  measureBadgeWidth(text, options = {}) {
    const { fontSize = 7, paddingX = 3.2 } = options;
    if (!text) return 0;
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', 'bold');
    return this.doc.getTextWidth(text) + 2 * paddingX;
  }

  // Add badge/pill with accurate pt-to-mm height & centering
  addBadge(text, x, y, options = {}) {
    const {
      fontSize = 7,
      paddingX = 3.2,
      paddingY = 1.4,
      backgroundColor = '#dcfce7',
      textColor = '#14532d',
      borderColor = null,
      borderRadius = 2.2
    } = options;

    if (!text) return { width: 0, height: 0 };

    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', 'bold');
    const textWidth = this.doc.getTextWidth(text);
    const fontHeightMm = fontSize * 25.4 / 72;
    const badgeWidth = textWidth + 2 * paddingX;
    const badgeHeight = fontHeightMm * 1.15 + 2 * paddingY;

    this.addRoundedRect(x, y, badgeWidth, badgeHeight, borderRadius, {
      fillColor: backgroundColor,
      strokeColor: borderColor,
      lineWidth: 0.25,
    });

    this.doc.setTextColor(textColor);
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', 'bold');
    const textY = y + badgeHeight / 2 + fontHeightMm * 0.34;
    this.doc.text(text, x + paddingX, textY);

    return { width: badgeWidth, height: badgeHeight };
  }

  // Save PDF
  save(filename = 'standee.pdf') {
    this.doc.save(filename);
  }

  // Get blob for preview
  getBlob() {
    return this.doc.output('blob');
  }

  // Get data URL for preview
  getDataURL() {
    return this.doc.output('datauristring');
  }
}

// Export singleton and factory function
let pdfInstance = null;

export async function createPDFGenerator(format = 'a4', orientation = 'portrait') {
  const generator = new PDFGenerator();
  await generator.init(format, orientation);
  pdfInstance = generator;
  return generator;
}

export function getPDFGenerator() {
  return pdfInstance;
}

export { PDFGenerator };
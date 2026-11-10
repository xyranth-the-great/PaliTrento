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

    lines.forEach((line, index) => {
      let x = this.margin;
      if (align === 'center') {
        x = this.pageWidth / 2;
      } else if (align === 'right') {
        x = this.pageWidth - this.margin;
      }

      this.doc.text(line, x, currentY, { align });
      currentY += fontSize * lineHeight;
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
    const { color = '#f6f3ec', fill = true } = options;
    this.doc.setFillColor(color);
    this.doc.rect(x, y, width, height, fill ? 'F' : 'S');
  }

  // Add badge/pill - with fallback for older jsPDF versions
  addBadge(text, x, y, options = {}) {
    const {
      fontSize = 8,
      paddingX = 6,
      paddingY = 2,
      backgroundColor = '#dcfce7',
      textColor = '#14532d',
      borderRadius = 3
    } = options;

    if (!text) return 0;

    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    const textWidth = this.doc.getTextWidth(text);
    const badgeWidth = textWidth + 2 * paddingX;
    const badgeHeight = 10 + 2 * paddingY;

    // Draw rounded rectangle background (with fallback)
    this.doc.setFillColor(backgroundColor);
    try {
      // Try roundedRect (available in jsPDF 2.0+)
      if (typeof this.doc.roundedRect === 'function') {
        this.doc.roundedRect(x, y, badgeWidth, badgeHeight, 2, 2, 'F');
      } else {
        // Fallback: regular rectangle
        this.doc.rect(x, y, badgeWidth, badgeHeight, 'F');
      }
    } catch (err) {
      console.warn('roundedRect failed, using fallback:', err);
      this.doc.rect(x, y, badgeWidth, badgeHeight, 'F');
    }

    // Add text
    this.doc.setTextColor(textColor);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(text, x + paddingX, y + 6.5);

    return badgeHeight;
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
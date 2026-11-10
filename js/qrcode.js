// QR Code Generator Utility
// Primary: qrcodejs from CDN
// Fallback: qrcode-generator (pure JS, no DOM needed)

let QRCodeLib = null;
let QRCodeGeneratorLib = null;

async function loadQRCodeLib() {
  if (QRCodeLib) return QRCodeLib;

  if (typeof window.QRCode !== 'undefined') {
    QRCodeLib = window.QRCode;
    return QRCodeLib;
  }

  // Load qrcodejs from CDN
  try {
    await new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="qrcodejs"]')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    QRCodeLib = window.QRCode;
    return QRCodeLib;
  } catch (e) {
    console.warn('qrcodejs failed to load, will use fallback');
  }
  return null;
}

async function loadQRCodeGeneratorLib() {
  if (QRCodeGeneratorLib) return QRCodeGeneratorLib;

  if (typeof window.qrcode !== 'undefined') {
    QRCodeGeneratorLib = window.qrcode;
    return QRCodeGeneratorLib;
  }

  try {
    await new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="qrcode-generator"]')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    QRCodeGeneratorLib = window.qrcode;
    return QRCodeGeneratorLib;
  } catch (e) {
    console.warn('qrcode-generator failed to load');
  }
  return null;
}

export class QRCodeGenerator {
  static async generate(data, options = {}) {
    const {
      size = 256,
      margin = 4,
      color = { dark: '#1f4d2e', light: '#ffffff' },
      errorCorrectionLevel = 'M'
    } = options;

    // Try qrcodejs first (renders to DOM)
    const lib = await loadQRCodeLib();
    if (lib) {
      try {
        const container = document.createElement('div');
        container.style.width = size + 'px';
        container.style.height = size + 'px';

        new lib(container, {
          text: data,
          width: size,
          height: size,
          colorDark: color.dark,
          colorLight: color.light,
          correctLevel: this._getECL(lib, errorCorrectionLevel)
        });

        await new Promise(r => setTimeout(r, 100));

        const canvas = container.querySelector('canvas');
        if (canvas) {
          const outputCanvas = document.createElement('canvas');
          outputCanvas.width = size;
          outputCanvas.height = size;
          const ctx = outputCanvas.getContext('2d');
          ctx.drawImage(canvas, 0, 0, size, size);
          return outputCanvas;
        }
      } catch (e) {
        console.warn('qrcodejs generation failed:', e);
      }
    }

    // Fallback: qrcode-generator (pure JS, renders to canvas directly)
    const genLib = await loadQRCodeGeneratorLib();
    if (genLib) {
      try {
        const typeNumber = 0; // auto
        const qr = genLib(typeNumber, this._getECLGen(genLib, errorCorrectionLevel));
        qr.addData(data);
        qr.make();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const moduleCount = qr.getModuleCount();
        const tileSize = (size - 2 * margin) / moduleCount;

        canvas.width = size;
        canvas.height = size;

        // White background
        ctx.fillStyle = color.light;
        ctx.fillRect(0, 0, size, size);

        // Draw modules
        ctx.fillStyle = color.dark;
        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (qr.isDark(row, col)) {
              const x = margin + col * tileSize;
              const y = margin + row * tileSize;
              ctx.fillRect(x, y, tileSize, tileSize);
            }
          }
        }
        return canvas;
      } catch (e) {
        console.warn('qrcode-generator failed:', e);
      }
    }

    // Last resort: empty canvas with error indicator
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fee2e2';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#b91c1c';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QR Code', size / 2, size / 2);
    ctx.fillText('Failed to generate', size / 2, size / 2 + 16);
    return canvas;
  }

  static _getECL(lib, level) {
    if (!lib) return 1;
    const levels = {
      'L': lib.CorrectLevel?.L || 1,
      'M': lib.CorrectLevel?.M || 0,
      'Q': lib.CorrectLevel?.Q || 3,
      'H': lib.CorrectLevel?.H || 2
    };
    return levels[level] ?? 0;
  }

  static _getECLGen(lib, level) {
    // qrcode-generator uses different constants
    const levels = {
      'L': 'L',
      'M': 'M',
      'Q': 'Q',
      'H': 'H'
    };
    return levels[level] || 'M';
  }

  static async toDataURL(data, options = {}) {
    const canvas = await this.generate(data, options);
    return canvas.toDataURL('image/png');
  }

  static async toBlob(data, options = {}) {
    const canvas = await this.generate(data, options);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }
}

export async function generateQRCode(data, options = {}) {
  return QRCodeGenerator.generate(data, options);
}

export async function generateQRCodeDataURL(data, options = {}) {
  return QRCodeGenerator.toDataURL(data, options);
}
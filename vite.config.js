import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';

const pages = [
  'index', 'explore', 'map', 'products', 'business', 'register', 'login',
  'account', 'verify', 'register-business', 'store-setup', 'dashboard',
  'chat', 'admin', 'admin-verification', 'admin-prices', 'admin-reports',
  'product-detail', 'standee', 'orders', 'settings', 'forgot-password',
  'reset-password', 'terms-and-agreement', 'advisories'
];

// Pages that should be directories (clean URLs) vs files
const directoryPages = new Set([
  'explore', 'map', 'products', 'business', 'register', 'login',
  'account', 'verify', 'register-business', 'store-setup', 'dashboard',
  'chat', 'admin', 'admin-verification', 'admin-prices', 'admin-reports',
  'product-detail', 'standee', 'orders', 'settings', 'forgot-password',
  'reset-password', 'terms-and-agreement', 'advisories'
]);

// Build input object for rollupOptions
const input = {};
for (const page of pages) {
  input[page] = resolve(__dirname, `${page}.html`);
}

// Dev middleware to serve clean URLs (e.g., /explore/ -> explore.html)
function cleanUrlsDevMiddleware() {
  return {
    name: 'clean-urls-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url.split('?')[0];
        // Skip if already has extension or is asset/api
        if (url.includes('.') || url.startsWith('/@') || url.startsWith('/api/') || url.startsWith('/node_modules/')) {
          return next();
        }
        // Check if it's a clean URL that maps to a directory page
        const cleanPath = url.replace(/^\/+|\/+$/g, ''); // remove leading/trailing slashes
        if (directoryPages.has(cleanPath)) {
          req.url = `/${cleanPath}.html`;
        }
        next();
      });
    }
  };
}

// Plugin to replace VAPID key placeholders at build time
function replaceVapidKeys() {
  return {
    name: 'replace-vapid-keys',
    transform(code, id) {
      if (id.endsWith('.js') || id.endsWith('.ts')) {
        const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || '';
        if (code.includes('{{VAPID_PUBLIC_KEY}}')) {
          return code.replace(/{{VAPID_PUBLIC_KEY}}/g, vapidPublicKey);
        }
      }
    },
    transformIndexHtml(html) {
      const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || '';
      return html.replace(/{{VAPID_PUBLIC_KEY}}/g, vapidPublicKey);
    }
  };
}

export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [cleanUrlsDevMiddleware(), replaceVapidKeys()],
  server: {
    watch: {
      ignored: ['**/.obsidian-vault/**']
    },
    allowedHosts: [
      'unabashed-hamper-cosponsor.ngrok-free.dev',
      '.ngrok-free.dev',
      '.ngrok-free.app',
      '.ngrok.io'
    ]
  },
  preview: {
    allowedHosts: [
      'unabashed-hamper-cosponsor.ngrok-free.dev',
      '.ngrok-free.dev',
      '.ngrok-free.app',
      '.ngrok.io'
    ]
  },
  esbuild: {
    target: 'es2022' },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: { input }
  }
});
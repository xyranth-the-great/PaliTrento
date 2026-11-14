import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const pages = [
  'index', 'explore', 'map', 'products', 'business', 'register', 'login',
  'account', 'verify', 'register-business', 'store-setup', 'dashboard',
  'chat', 'admin', 'admin-verification', 'admin-prices', 'admin-reports',
  'product-detail', 'standee', 'orders', 'settings', 'forgot-password',
  'reset-password', 'terms-and-agreement'
];

// Pages that should be directories (clean URLs) vs files
const directoryPages = new Set([
  'explore', 'map', 'products', 'business', 'register', 'login',
  'account', 'verify', 'register-business', 'store-setup', 'dashboard',
  'chat', 'admin', 'admin-verification', 'admin-prices', 'admin-reports',
  'product-detail', 'standee', 'orders', 'settings', 'forgot-password',
  'reset-password', 'terms-and-agreement'
]);

// Build input object for rollupOptions
const input = {};
for (const page of pages) {
  input[page] = resolve(__dirname, `${page}.html`);
}

export default defineConfig({
  base: './',
  publicDir: 'public',
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
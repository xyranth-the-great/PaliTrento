import { defineConfig } from 'vite';
import { resolve } from 'node:path';
const pages = ['index', 'explore', 'map', 'products', 'business', 'register', 'login', 'account', 'verify', 'register-business', 'store-setup', 'dashboard', 'chat', 'admin', 'admin-verification', 'admin-prices', 'admin-reports', 'product-detail', 'standee', 'orders'];
export default defineConfig({
  base: process.env.BASE_PATH || './',
  publicDir: 'public',
  server: {
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
    outDir: 'dist-fix',
    rollupOptions: {
      input: Object.fromEntries(pages.map(p => [p, resolve(__dirname, `${p}.html`)]))
    }
  }
});
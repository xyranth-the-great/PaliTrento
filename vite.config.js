import { defineConfig } from 'vite';
import { resolve } from 'node:path';
const pages = ['index', 'explore', 'map', 'products', 'business', 'register', 'login', 'account', 'verify', 'register-business', 'store-setup', 'dashboard', 'chat', 'admin', 'admin-verification', 'admin-prices', 'admin-reports', 'product-detail', 'standee'];
export default defineConfig({
  base: process.env.BASE_PATH || './',
  publicDir: 'public',
  esbuild: {
    target: 'es2022' },
  build: {
    target: 'es2022',
    outDir: 'dist-test',
    rollupOptions: {
      input: Object.fromEntries(pages.map(p => [p, resolve(__dirname, `${p}.html`)]))
    }
  }
});

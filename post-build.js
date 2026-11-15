#!/usr/bin/env node
// Post-build script to move HTML files to directory structure for clean URLs
import fs from 'node:fs';
import { resolve } from 'node:path';

const outDir = process.argv[2] || 'dist';

const pages = [
  'index', 'explore', 'map', 'products', 'business', 'register', 'login',
  'account', 'verify', 'register-business', 'store-setup', 'dashboard',
  'chat', 'admin', 'admin-verification', 'admin-prices', 'admin-reports', 'admin-accounts',
  'product-detail', 'standee', 'orders', 'settings', 'forgot-password',
  'reset-password', 'terms-and-agreement', 'advisories'
];

// Pages that should be directories (clean URLs) vs files
const directoryPages = new Set([
  'explore', 'map', 'products', 'business', 'register', 'login',
  'account', 'verify', 'register-business', 'store-setup', 'dashboard',
  'chat', 'admin', 'admin-verification', 'admin-prices', 'admin-reports', 'admin-accounts',
  'product-detail', 'standee', 'orders', 'settings', 'forgot-password',
  'reset-password', 'terms-and-agreement', 'advisories'
]);

// Static files to copy to each directory (logo, favicon, etc.)
const staticFiles = ['logo.png', 'favicon.svg'];

console.log(`[post-build] Processing ${outDir}...`);

// Copy assets folder to each page directory for relative paths to work
function copyAssetsToDir(destDir) {
  const assetsSrc = resolve(outDir, 'assets');
  const assetsDest = resolve(destDir, 'assets');
  if (fs.existsSync(assetsSrc) && !fs.existsSync(assetsDest)) {
    fs.cpSync(assetsSrc, assetsDest, { recursive: true });
  }
}

// Copy static files (logo.png, favicon.svg) to each page directory
function copyStaticFilesToDir(destDir) {
  for (const file of staticFiles) {
    const src = resolve(outDir, file);
    const dest = resolve(destDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }
}

for (const page of pages) {
  if (directoryPages.has(page)) {
    const src = resolve(outDir, `${page}.html`);
    const destDir = resolve(outDir, page);
    const dest = resolve(destDir, 'index.html');

    if (fs.existsSync(src)) {
      // Create directory if it doesn't exist
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      // Move the file
      fs.renameSync(src, dest);
      console.log(`Moved ${page}.html -> ${page}/index.html`);

      // Copy assets for relative paths
      copyAssetsToDir(destDir);
      // Copy static files (logo.png, favicon.svg)
      copyStaticFilesToDir(destDir);
    }
  }
}

// Also copy assets to root for index.html
const rootAssetsDest = resolve(outDir, 'assets');
const assetsSrc = resolve(outDir, 'assets');
if (fs.existsSync(assetsSrc) && !fs.existsSync(rootAssetsDest)) {
  // Already there from build
}

console.log('[post-build] Done!');
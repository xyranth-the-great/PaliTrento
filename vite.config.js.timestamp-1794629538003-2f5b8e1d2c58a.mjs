// vite.config.js
import { defineConfig } from "file:///sessions/gallant-focused-pascal/mnt/palitrento2/node_modules/vite/dist/node/index.js";
import { resolve } from "node:path";
import fs from "node:fs";
var __vite_injected_original_dirname = "/sessions/gallant-focused-pascal/mnt/palitrento2";
var pages = [
  "index",
  "explore",
  "map",
  "products",
  "business",
  "register",
  "login",
  "account",
  "verify",
  "register-business",
  "store-setup",
  "dashboard",
  "chat",
  "admin",
  "admin-verification",
  "admin-prices",
  "admin-reports",
  "product-detail",
  "standee",
  "orders",
  "settings",
  "forgot-password",
  "reset-password",
  "terms-and-agreement"
];
var directoryPages = /* @__PURE__ */ new Set([
  "explore",
  "map",
  "products",
  "business",
  "register",
  "login",
  "account",
  "verify",
  "register-business",
  "store-setup",
  "dashboard",
  "chat",
  "admin",
  "admin-verification",
  "admin-prices",
  "admin-reports",
  "product-detail",
  "standee",
  "orders",
  "settings",
  "forgot-password",
  "reset-password",
  "terms-and-agreement"
]);
var input = {};
for (const page of pages) {
  input[page] = resolve(__vite_injected_original_dirname, `${page}.html`);
}
function moveHtmlToDirectories() {
  let outDir = "dist";
  return {
    name: "move-html-to-directories",
    configResolved(config) {
      outDir = config.build.outDir || "dist";
    },
    // Use writeBundle which runs after all files are written
    writeBundle() {
      console.log("[plugin] writeBundle called, moving HTML files...");
      for (const page of pages) {
        if (directoryPages.has(page)) {
          const src = resolve(__vite_injected_original_dirname, outDir, `${page}.html`);
          const destDir = resolve(__vite_injected_original_dirname, outDir, page);
          const dest = resolve(destDir, "index.html");
          if (fs.existsSync(src)) {
            if (!fs.existsSync(destDir)) {
              fs.mkdirSync(destDir, { recursive: true });
            }
            fs.renameSync(src, dest);
            console.log(`Moved ${page}.html -> ${page}/index.html`);
          }
        }
      }
    }
  };
}
var vite_config_default = defineConfig({
  base: "./",
  publicDir: "public",
  server: {
    watch: {
      ignored: ["**/.obsidian-vault/**"]
    },
    allowedHosts: [
      "unabashed-hamper-cosponsor.ngrok-free.dev",
      ".ngrok-free.dev",
      ".ngrok-free.app",
      ".ngrok.io"
    ]
  },
  preview: {
    allowedHosts: [
      "unabashed-hamper-cosponsor.ngrok-free.dev",
      ".ngrok-free.dev",
      ".ngrok-free.app",
      ".ngrok.io"
    ]
  },
  esbuild: {
    target: "es2022"
  },
  build: {
    target: "es2022",
    outDir: "dist",
    rollupOptions: { input },
    plugins: [moveHtmlToDirectories()]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZ2FsbGFudC1mb2N1c2VkLXBhc2NhbC9tbnQvcGFsaXRyZW50bzJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9nYWxsYW50LWZvY3VzZWQtcGFzY2FsL21udC9wYWxpdHJlbnRvMi92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvZ2FsbGFudC1mb2N1c2VkLXBhc2NhbC9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcclxuXHJcbmNvbnN0IHBhZ2VzID0gW1xyXG4gICdpbmRleCcsICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsXHJcbiAgJ2FjY291bnQnLCAndmVyaWZ5JywgJ3JlZ2lzdGVyLWJ1c2luZXNzJywgJ3N0b3JlLXNldHVwJywgJ2Rhc2hib2FyZCcsXHJcbiAgJ2NoYXQnLCAnYWRtaW4nLCAnYWRtaW4tdmVyaWZpY2F0aW9uJywgJ2FkbWluLXByaWNlcycsICdhZG1pbi1yZXBvcnRzJyxcclxuICAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJyxcclxuICAncmVzZXQtcGFzc3dvcmQnLCAndGVybXMtYW5kLWFncmVlbWVudCdcclxuXTtcclxuXHJcbi8vIFBhZ2VzIHRoYXQgc2hvdWxkIGJlIGRpcmVjdG9yaWVzIChjbGVhbiBVUkxzKSB2cyBmaWxlc1xyXG5jb25zdCBkaXJlY3RvcnlQYWdlcyA9IG5ldyBTZXQoW1xyXG4gICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsXHJcbiAgJ2FjY291bnQnLCAndmVyaWZ5JywgJ3JlZ2lzdGVyLWJ1c2luZXNzJywgJ3N0b3JlLXNldHVwJywgJ2Rhc2hib2FyZCcsXHJcbiAgJ2NoYXQnLCAnYWRtaW4nLCAnYWRtaW4tdmVyaWZpY2F0aW9uJywgJ2FkbWluLXByaWNlcycsICdhZG1pbi1yZXBvcnRzJyxcclxuICAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJyxcclxuICAncmVzZXQtcGFzc3dvcmQnLCAndGVybXMtYW5kLWFncmVlbWVudCdcclxuXSk7XHJcblxyXG4vLyBCdWlsZCBpbnB1dCBvYmplY3QgZm9yIHJvbGx1cE9wdGlvbnNcclxuY29uc3QgaW5wdXQgPSB7fTtcclxuZm9yIChjb25zdCBwYWdlIG9mIHBhZ2VzKSB7XHJcbiAgaW5wdXRbcGFnZV0gPSByZXNvbHZlKF9fZGlybmFtZSwgYCR7cGFnZX0uaHRtbGApO1xyXG59XHJcblxyXG4vLyBDdXN0b20gcGx1Z2luIHRvIG1vdmUgSFRNTCBmaWxlcyB0byBkaXJlY3Rvcnkgc3RydWN0dXJlIGFmdGVyIGJ1aWxkXHJcbmZ1bmN0aW9uIG1vdmVIdG1sVG9EaXJlY3RvcmllcygpIHtcclxuICBsZXQgb3V0RGlyID0gJ2Rpc3QnO1xyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiAnbW92ZS1odG1sLXRvLWRpcmVjdG9yaWVzJyxcclxuICAgIGNvbmZpZ1Jlc29sdmVkKGNvbmZpZykge1xyXG4gICAgICBvdXREaXIgPSBjb25maWcuYnVpbGQub3V0RGlyIHx8ICdkaXN0JztcclxuICAgIH0sXHJcbiAgICAvLyBVc2Ugd3JpdGVCdW5kbGUgd2hpY2ggcnVucyBhZnRlciBhbGwgZmlsZXMgYXJlIHdyaXR0ZW5cclxuICAgIHdyaXRlQnVuZGxlKCkge1xyXG4gICAgICBjb25zb2xlLmxvZygnW3BsdWdpbl0gd3JpdGVCdW5kbGUgY2FsbGVkLCBtb3ZpbmcgSFRNTCBmaWxlcy4uLicpO1xyXG4gICAgICBmb3IgKGNvbnN0IHBhZ2Ugb2YgcGFnZXMpIHtcclxuICAgICAgICBpZiAoZGlyZWN0b3J5UGFnZXMuaGFzKHBhZ2UpKSB7XHJcbiAgICAgICAgICBjb25zdCBzcmMgPSByZXNvbHZlKF9fZGlybmFtZSwgb3V0RGlyLCBgJHtwYWdlfS5odG1sYCk7XHJcbiAgICAgICAgICBjb25zdCBkZXN0RGlyID0gcmVzb2x2ZShfX2Rpcm5hbWUsIG91dERpciwgcGFnZSk7XHJcbiAgICAgICAgICBjb25zdCBkZXN0ID0gcmVzb2x2ZShkZXN0RGlyLCAnaW5kZXguaHRtbCcpO1xyXG5cclxuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHNyYykpIHtcclxuICAgICAgICAgICAgLy8gQ3JlYXRlIGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XHJcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhkZXN0RGlyKSkge1xyXG4gICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhkZXN0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBNb3ZlIHRoZSBmaWxlXHJcbiAgICAgICAgICAgIGZzLnJlbmFtZVN5bmMoc3JjLCBkZXN0KTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYE1vdmVkICR7cGFnZX0uaHRtbCAtPiAke3BhZ2V9L2luZGV4Lmh0bWxgKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIGJhc2U6ICcuLycsXHJcbiAgcHVibGljRGlyOiAncHVibGljJyxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHdhdGNoOiB7XHJcbiAgICAgIGlnbm9yZWQ6IFsnKiovLm9ic2lkaWFuLXZhdWx0LyoqJ11cclxuICAgIH0sXHJcbiAgICBhbGxvd2VkSG9zdHM6IFtcclxuICAgICAgJ3VuYWJhc2hlZC1oYW1wZXItY29zcG9uc29yLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5hcHAnLFxyXG4gICAgICAnLm5ncm9rLmlvJ1xyXG4gICAgXVxyXG4gIH0sXHJcbiAgcHJldmlldzoge1xyXG4gICAgYWxsb3dlZEhvc3RzOiBbXHJcbiAgICAgICd1bmFiYXNoZWQtaGFtcGVyLWNvc3BvbnNvci5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuYXBwJyxcclxuICAgICAgJy5uZ3Jvay5pbydcclxuICAgIF1cclxuICB9LFxyXG4gIGVzYnVpbGQ6IHtcclxuICAgIHRhcmdldDogJ2VzMjAyMicgfSxcclxuICBidWlsZDoge1xyXG4gICAgdGFyZ2V0OiAnZXMyMDIyJyxcclxuICAgIG91dERpcjogJ2Rpc3QnLFxyXG4gICAgcm9sbHVwT3B0aW9uczogeyBpbnB1dCB9LFxyXG4gICAgcGx1Z2luczogW21vdmVIdG1sVG9EaXJlY3RvcmllcygpXVxyXG4gIH1cclxufSk7Il0sCiAgIm1hcHBpbmdzIjogIjtBQUFrVSxTQUFTLG9CQUFvQjtBQUMvVixTQUFTLGVBQWU7QUFDeEIsT0FBTyxRQUFRO0FBRmYsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTSxRQUFRO0FBQUEsRUFDWjtBQUFBLEVBQVM7QUFBQSxFQUFXO0FBQUEsRUFBTztBQUFBLEVBQVk7QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQy9EO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFxQjtBQUFBLEVBQWU7QUFBQSxFQUN6RDtBQUFBLEVB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

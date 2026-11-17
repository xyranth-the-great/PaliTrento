// vite.config.js
import { defineConfig } from "file:///sessions/gallant-focused-pascal/mnt/palitrento2/node_modules/vite/dist/node/index.js";
import { resolve } from "node:path";
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
function getInputEntry(page) {
  const htmlPath = resolve(__vite_injected_original_dirname, `${page}.html`);
  if (directoryPages.has(page)) {
    return { [page]: { input: htmlPath, fileName: `${page}/index.html` } };
  }
  return { [page]: { input: htmlPath, fileName: "index.html" } };
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
    rollupOptions: {
      input: Object.assign({}, ...pages.map(getInputEntry))
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZ2FsbGFudC1mb2N1c2VkLXBhc2NhbC9tbnQvcGFsaXRyZW50bzJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9nYWxsYW50LWZvY3VzZWQtcGFzY2FsL21udC9wYWxpdHJlbnRvMi92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvZ2FsbGFudC1mb2N1c2VkLXBhc2NhbC9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcblxyXG5jb25zdCBwYWdlcyA9IFtcclxuICAnaW5kZXgnLCAnZXhwbG9yZScsICdtYXAnLCAncHJvZHVjdHMnLCAnYnVzaW5lc3MnLCAncmVnaXN0ZXInLCAnbG9naW4nLFxyXG4gICdhY2NvdW50JywgJ3ZlcmlmeScsICdyZWdpc3Rlci1idXNpbmVzcycsICdzdG9yZS1zZXR1cCcsICdkYXNoYm9hcmQnLFxyXG4gICdjaGF0JywgJ2FkbWluJywgJ2FkbWluLXZlcmlmaWNhdGlvbicsICdhZG1pbi1wcmljZXMnLCAnYWRtaW4tcmVwb3J0cycsXHJcbiAgJ3Byb2R1Y3QtZGV0YWlsJywgJ3N0YW5kZWUnLCAnb3JkZXJzJywgJ3NldHRpbmdzJywgJ2ZvcmdvdC1wYXNzd29yZCcsXHJcbiAgJ3Jlc2V0LXBhc3N3b3JkJywgJ3Rlcm1zLWFuZC1hZ3JlZW1lbnQnXHJcbl07XHJcblxyXG4vLyBQYWdlcyB0aGF0IHNob3VsZCBiZSBkaXJlY3RvcmllcyAoY2xlYW4gVVJMcykgdnMgZmlsZXNcclxuY29uc3QgZGlyZWN0b3J5UGFnZXMgPSBuZXcgU2V0KFtcclxuICAnZXhwbG9yZScsICdtYXAnLCAncHJvZHVjdHMnLCAnYnVzaW5lc3MnLCAncmVnaXN0ZXInLCAnbG9naW4nLFxyXG4gICdhY2NvdW50JywgJ3ZlcmlmeScsICdyZWdpc3Rlci1idXNpbmVzcycsICdzdG9yZS1zZXR1cCcsICdkYXNoYm9hcmQnLFxyXG4gICdjaGF0JywgJ2FkbWluJywgJ2FkbWluLXZlcmlmaWNhdGlvbicsICdhZG1pbi1wcmljZXMnLCAnYWRtaW4tcmVwb3J0cycsXHJcbiAgJ3Byb2R1Y3QtZGV0YWlsJywgJ3N0YW5kZWUnLCAnb3JkZXJzJywgJ3NldHRpbmdzJywgJ2ZvcmdvdC1wYXNzd29yZCcsXHJcbiAgJ3Jlc2V0LXBhc3N3b3JkJywgJ3Rlcm1zLWFuZC1hZ3JlZW1lbnQnXHJcbl0pO1xyXG5cclxuZnVuY3Rpb24gZ2V0SW5wdXRFbnRyeShwYWdlKSB7XHJcbiAgY29uc3QgaHRtbFBhdGggPSByZXNvbHZlKF9fZGlybmFtZSwgYCR7cGFnZX0uaHRtbGApO1xyXG4gIGlmIChkaXJlY3RvcnlQYWdlcy5oYXMocGFnZSkpIHtcclxuICAgIC8vIE91dHB1dCB0byBkaXN0L3BhZ2UvaW5kZXguaHRtbFxyXG4gICAgcmV0dXJuIHsgW3BhZ2VdOiB7IGlucHV0OiBodG1sUGF0aCwgZmlsZU5hbWU6IGAke3BhZ2V9L2luZGV4Lmh0bWxgIH0gfTtcclxuICB9XHJcbiAgLy8gaW5kZXguaHRtbCBzdGF5cyBhdCByb290XHJcbiAgcmV0dXJuIHsgW3BhZ2VdOiB7IGlucHV0OiBodG1sUGF0aCwgZmlsZU5hbWU6ICdpbmRleC5odG1sJyB9IH07XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgYmFzZTogJy4vJyxcclxuICBwdWJsaWNEaXI6ICdwdWJsaWMnLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgd2F0Y2g6IHtcclxuICAgICAgaWdub3JlZDogWycqKi8ub2JzaWRpYW4tdmF1bHQvKionXVxyXG4gICAgfSxcclxuICAgIGFsbG93ZWRIb3N0czogW1xyXG4gICAgICAndW5hYmFzaGVkLWhhbXBlci1jb3Nwb25zb3Iubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmFwcCcsXHJcbiAgICAgICcubmdyb2suaW8nXHJcbiAgICBdXHJcbiAgfSxcclxuICBwcmV2aWV3OiB7XHJcbiAgICBhbGxvd2VkSG9zdHM6IFtcclxuICAgICAgJ3VuYWJhc2hlZC1oYW1wZXItY29zcG9uc29yLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5hcHAnLFxyXG4gICAgICAnLm5ncm9rLmlvJ1xyXG4gICAgXVxyXG4gIH0sXHJcbiAgZXNidWlsZDoge1xyXG4gICAgdGFyZ2V0OiAnZXMyMDIyJyB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICB0YXJnZXQ6ICdlczIwMjInLFxyXG4gICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIGlucHV0OiBPYmplY3QuYXNzaWduKHt9LCAuLi5wYWdlcy5tYXAoZ2V0SW5wdXRFbnRyeSkpXHJcbiAgICB9XHJcbiAgfVxyXG59KTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQWtVLFNBQVMsb0JBQW9CO0FBQy9WLFNBQVMsZUFBZTtBQUR4QixJQUFNLG1DQUFtQztBQUd6QyxJQUFNLFFBQVE7QUFBQSxFQUNaO0FBQUEsRUFBUztBQUFBLEVBQVc7QUFBQSxFQUFPO0FBQUEsRUFBWTtBQUFBLEVBQVk7QUFBQSxFQUFZO0FBQUEsRUFDL0Q7QUFBQSxFQUFXO0FBQUEsRUFBVTtBQUFBLEVBQXFCO0FBQUEsRUFBZTtBQUFBLEVBQ3pEO0FBQUEsRUFBUTtBQUFBLEVBQVM7QUFBQSxFQUFzQjtBQUFBLEVBQWdCO0FBQUEsRUFDdkQ7QUFBQSxFQUFrQjtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBWTtBQUFBLEVBQ25EO0FBQUEsRUFBa0I7QUFDcEI7QUFHQSxJQUFNLGlCQUFpQixvQkFBSSxJQUFJO0FBQUEsRUFDN0I7QUFBQSxFQUFXO0FBQUEsRUFBTztBQUFBLEVBQVk7QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQ3REO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFxQjtBQUFBLEVBQWU7QUFBQSxFQUN6RDtBQUFBLEVBQVE7QUFBQSxFQUFTO0FBQUEsRUFBc0I7QUFBQSxFQUFnQjtBQUFBLEVBQ3ZEO0FBQUEsRUFBa0I7QUFBQSxFQUFXO0FBQUEsRUFBVTtBQUFBLEVBQVk7QUFBQSxFQUNuRDtBQUFBLEVBQWtCO0FBQ3BCLENBQUM7QUFFRCxTQUFTLGNBQWMsTUFBTTtBQUMzQixRQUFNLFdBQVcsUUFBUSxrQ0FBVyxHQUFHLElBQUksT0FBTztBQUNsRCxNQUFJLGVBQWUsSUFBSSxJQUFJLEdBQUc7QUFFNUIsV0FBTyxFQUFFLENBQUMsSUFBSSxHQUFHLEVBQUUsT0FBTyxVQUFVLFVBQVUsR0FBRyxJQUFJLGNBQWMsRUFBRTtBQUFBLEVBQ3ZFO0FBRUEsU0FBTyxFQUFFLENBQUMsSUFBSSxHQUFHLEVBQUUsT0FBTyxVQUFVLFVBQVUsYUFBYSxFQUFFO0FBQy9EO0FBRUEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsTUFBTTtBQUFBLEVBQ04sV0FBVztBQUFBLEVBQ1gsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsU0FBUyxDQUFDLHVCQUF1QjtBQUFBLElBQ25DO0FBQUEsSUFDQSxjQUFjO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxjQUFjO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxRQUFRO0FBQUEsRUFBUztBQUFBLEVBQ25CLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLE9BQU8sT0FBTyxPQUFPLENBQUMsR0FBRyxHQUFHLE1BQU0sSUFBSSxhQUFhLENBQUM7QUFBQSxJQUN0RDtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=

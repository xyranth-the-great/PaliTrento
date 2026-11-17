// vite.config.js
import { defineConfig } from "file:///sessions/quirky-nice-archimedes/mnt/palitrento2/node_modules/vite/dist/node/index.js";
import { resolve } from "node:path";
var __vite_injected_original_dirname = "/sessions/quirky-nice-archimedes/mnt/palitrento2";
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
  "admin-verification-docs",
  "admin-prices",
  "admin-reports",
  "admin-reports-management",
  "admin-accounts",
  "admin-support",
  "product-detail",
  "standee",
  "orders",
  "settings",
  "forgot-password",
  "reset-password",
  "terms-and-agreement",
  "advisories",
  "suspended",
  "banned",
  "auth-status",
  "report-business",
  "report-product",
  "support"
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
  "admin-verification-docs",
  "admin-prices",
  "admin-reports",
  "admin-reports-management",
  "admin-accounts",
  "admin-support",
  "product-detail",
  "standee",
  "orders",
  "settings",
  "forgot-password",
  "reset-password",
  "terms-and-agreement",
  "advisories",
  "suspended",
  "banned",
  "auth-status",
  "report-business",
  "report-product",
  "support"
]);
var input = {};
input.supabase = resolve(__vite_injected_original_dirname, "js/supabase.js");
for (const page of pages) {
  input[page] = resolve(__vite_injected_original_dirname, `${page}.html`);
}
function cleanUrlsDevMiddleware() {
  return {
    name: "clean-urls-dev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url.split("?")[0];
        if (url.includes(".") || url.startsWith("/@") || url.startsWith("/api/") || url.startsWith("/node_modules/")) {
          return next();
        }
        const cleanPath = url.replace(/^\/+|\/+$/g, "");
        if (directoryPages.has(cleanPath)) {
          req.url = `/${cleanPath}.html`;
        }
        next();
      });
    }
  };
}
function replaceVapidKeys() {
  return {
    name: "replace-vapid-keys",
    transform(code, id) {
      if (id.endsWith(".js") || id.endsWith(".ts")) {
        const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || "";
        if (code.includes("{{VAPID_PUBLIC_KEY}}")) {
          return code.replace(/{{VAPID_PUBLIC_KEY}}/g, vapidPublicKey);
        }
      }
    },
    transformIndexHtml(html) {
      const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || "";
      return html.replace(/{{VAPID_PUBLIC_KEY}}/g, vapidPublicKey);
    }
  };
}
var vite_config_default = defineConfig({
  base: "./",
  publicDir: "public",
  plugins: [cleanUrlsDevMiddleware(), replaceVapidKeys()],
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
    target: "es2022",
    treeShaking: false
  },
  build: {
    target: "es2022",
    outDir: "/tmp/palitrento-build",
    treeshake: false,
    rollupOptions: {
      input,
      treeshake: false
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvcXVpcmt5LW5pY2UtYXJjaGltZWRlcy9tbnQvcGFsaXRyZW50bzJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9xdWlya3ktbmljZS1hcmNoaW1lZGVzL21udC9wYWxpdHJlbnRvMi92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvcXVpcmt5LW5pY2UtYXJjaGltZWRlcy9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnO1xuXG5jb25zdCBwYWdlcyA9IFtcbiAgJ2luZGV4JywgJ2V4cGxvcmUnLCAnbWFwJywgJ3Byb2R1Y3RzJywgJ2J1c2luZXNzJywgJ3JlZ2lzdGVyJywgJ2xvZ2luJyxcbiAgJ2FjY291bnQnLCAndmVyaWZ5JywgJ3JlZ2lzdGVyLWJ1c2luZXNzJywgJ3N0b3JlLXNldHVwJywgJ2Rhc2hib2FyZCcsXG4gICdjaGF0JywgJ2FkbWluJywgJ2FkbWluLXZlcmlmaWNhdGlvbicsICdhZG1pbi12ZXJpZmljYXRpb24tZG9jcycsICdhZG1pbi1wcmljZXMnLCAnYWRtaW4tcmVwb3J0cycsICdhZG1pbi1yZXBvcnRzLW1hbmFnZW1lbnQnLCAnYWRtaW4tYWNjb3VudHMnLCAnYWRtaW4tc3VwcG9ydCcsXG4gICdwcm9kdWN0LWRldGFpbCcsICdzdGFuZGVlJywgJ29yZGVycycsICdzZXR0aW5ncycsICdmb3Jnb3QtcGFzc3dvcmQnLFxuICAncmVzZXQtcGFzc3dvcmQnLCAndGVybXMtYW5kLWFncmVlbWVudCcsICdhZHZpc29yaWVzJywgJ3N1c3BlbmRlZCcsICdiYW5uZWQnLCAnYXV0aC1zdGF0dXMnLFxuICAncmVwb3J0LWJ1c2luZXNzJywgJ3JlcG9ydC1wcm9kdWN0JywgJ3N1cHBvcnQnXG5dO1xuXG4vLyBQYWdlcyB0aGF0IHNob3VsZCBiZSBkaXJlY3RvcmllcyAoY2xlYW4gVVJMcykgdnMgZmlsZXNcbmNvbnN0IGRpcmVjdG9yeVBhZ2VzID0gbmV3IFNldChbXG4gICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsXG4gICdhY2NvdW50JywgJ3ZlcmlmeScsICdyZWdpc3Rlci1idXNpbmVzcycsICdzdG9yZS1zZXR1cCcsICdkYXNoYm9hcmQnLFxuICAnY2hhdCcsICdhZG1pbicsICdhZG1pbi12ZXJpZmljYXRpb24nLCAnYWRtaW4tdmVyaWZpY2F0aW9uLWRvY3MnLCAnYWRtaW4tcHJpY2VzJywgJ2FkbWluLXJlcG9ydHMnLCAnYWRtaW4tcmVwb3J0cy1tYW5hZ2VtZW50JywgJ2FkbWluLWFjY291bnRzJywgJ2FkbWluLXN1cHBvcnQnLFxuICAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJyxcbiAgJ3Jlc2V0LXBhc3N3b3JkJywgJ3Rlcm1zLWFuZC1hZ3JlZW1lbnQnLCAnYWR2aXNvcmllcycsICdzdXNwZW5kZWQnLCAnYmFubmVkJywgJ2F1dGgtc3RhdHVzJyxcbiAgJ3JlcG9ydC1idXNpbmVzcycsICdyZXBvcnQtcHJvZHVjdCcsICdzdXBwb3J0J1xuXSk7XG5cbi8vIEJ1aWxkIGlucHV0IG9iamVjdCBmb3Igcm9sbHVwT3B0aW9uc1xuY29uc3QgaW5wdXQgPSB7fTtcbiAgaW5wdXQuc3VwYWJhc2UgPSByZXNvbHZlKF9fZGlybmFtZSwgJ2pzL3N1cGFiYXNlLmpzJyk7XG5mb3IgKGNvbnN0IHBhZ2Ugb2YgcGFnZXMpIHtcbiAgaW5wdXRbcGFnZV0gPSByZXNvbHZlKF9fZGlybmFtZSwgYCR7cGFnZX0uaHRtbGApO1xufVxuXG4vLyBEZXYgbWlkZGxld2FyZSB0byBzZXJ2ZSBjbGVhbiBVUkxzIChlLmcuLCAvZXhwbG9yZS8gLT4gZXhwbG9yZS5odG1sKVxuZnVuY3Rpb24gY2xlYW5VcmxzRGV2TWlkZGxld2FyZSgpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnY2xlYW4tdXJscy1kZXYnLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgIGNvbnN0IHVybCA9IHJlcS51cmwuc3BsaXQoJz8nKVswXTtcbiAgICAgICAgLy8gU2tpcCBpZiBhbHJlYWR5IGhhcyBleHRlbnNpb24gb3IgaXMgYXNzZXQvYXBpXG4gICAgICAgIGlmICh1cmwuaW5jbHVkZXMoJy4nKSB8fCB1cmwuc3RhcnRzV2l0aCgnL0AnKSB8fCB1cmwuc3RhcnRzV2l0aCgnL2FwaS8nKSB8fCB1cmwuc3RhcnRzV2l0aCgnL25vZGVfbW9kdWxlcy8nKSkge1xuICAgICAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2hlY2sgaWYgaXQncyBhIGNsZWFuIFVSTCB0aGF0IG1hcHMgdG8gYSBkaXJlY3RvcnkgcGFnZVxuICAgICAgICBjb25zdCBjbGVhblBhdGggPSB1cmwucmVwbGFjZSgvXlxcLyt8XFwvKyQvZywgJycpOyAvLyByZW1vdmUgbGVhZGluZy90cmFpbGluZyBzbGFzaGVzXG4gICAgICAgIGlmIChkaXJlY3RvcnlQYWdlcy5oYXMoY2xlYW5QYXRoKSkge1xuICAgICAgICAgIHJlcS51cmwgPSBgLyR7Y2xlYW5QYXRofS5odG1sYDtcbiAgICAgICAgfVxuICAgICAgICBuZXh0KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG59XG5cbi8vIFBsdWdpbiB0byByZXBsYWNlIFZBUElEIGtleSBwbGFjZWhvbGRlcnMgYXQgYnVpbGQgdGltZVxuZnVuY3Rpb24gcmVwbGFjZVZhcGlkS2V5cygpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAncmVwbGFjZS12YXBpZC1rZXlzJyxcbiAgICB0cmFuc2Zvcm0oY29kZSwgaWQpIHtcbiAgICAgIGlmIChpZC5lbmRzV2l0aCgnLmpzJykgfHwgaWQuZW5kc1dpdGgoJy50cycpKSB7XG4gICAgICAgIGNvbnN0IHZhcGlkUHVibGljS2V5ID0gcHJvY2Vzcy5lbnYuVklURV9WQVBJRF9QVUJMSUNfS0VZIHx8ICcnO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcygne3tWQVBJRF9QVUJMSUNfS0VZfX0nKSkge1xuICAgICAgICAgIHJldHVybiBjb2RlLnJlcGxhY2UoL3t7VkFQSURfUFVCTElDX0tFWX19L2csIHZhcGlkUHVibGljS2V5KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgdHJhbnNmb3JtSW5kZXhIdG1sKGh0bWwpIHtcbiAgICAgIGNvbnN0IHZhcGlkUHVibGljS2V5ID0gcHJvY2Vzcy5lbnYuVklURV9WQVBJRF9QVUJMSUNfS0VZIHx8ICcnO1xuICAgICAgcmV0dXJuIGh0bWwucmVwbGFjZSgve3tWQVBJRF9QVUJMSUNfS0VZfX0vZywgdmFwaWRQdWJsaWNLZXkpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgYmFzZTogJy4vJyxcbiAgcHVibGljRGlyOiAncHVibGljJyxcbiAgcGx1Z2luczogW2NsZWFuVXJsc0Rldk1pZGRsZXdhcmUoKSwgcmVwbGFjZVZhcGlkS2V5cygpXSxcbiAgc2VydmVyOiB7XG4gICAgd2F0Y2g6IHtcbiAgICAgIGlnbm9yZWQ6IFsnKiovLm9ic2lkaWFuLXZhdWx0LyoqJ11cbiAgICB9LFxuICAgIGFsbG93ZWRIb3N0czogW1xuICAgICAgJ3VuYWJhc2hlZC1oYW1wZXItY29zcG9uc29yLm5ncm9rLWZyZWUuZGV2JyxcbiAgICAgICcubmdyb2stZnJlZS5kZXYnLFxuICAgICAgJy5uZ3Jvay1mcmVlLmFwcCcsXG4gICAgICAnLm5ncm9rLmlvJ1xuICAgIF1cbiAgfSxcbiAgcHJldmlldzoge1xuICAgIGFsbG93ZWRIb3N0czogW1xuICAgICAgJ3VuYWJhc2hlZC1oYW1wZXItY29zcG9uc29yLm5ncm9rLWZyZWUuZGV2JyxcbiAgICAgICcubmdyb2stZnJlZS5kZXYnLFxuICAgICAgJy5uZ3Jvay1mcmVlLmFwcCcsXG4gICAgICAnLm5ncm9rLmlvJ1xuICAgIF1cbiAgfSxcbiAgZXNidWlsZDoge1xuICAgIHRhcmdldDogJ2VzMjAyMicsXG4gICAgdHJlZVNoYWtpbmc6IGZhbHNlXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXMyMDIyJyxcbiAgICBvdXREaXI6ICcvdG1wL3BhbGl0cmVudG8tYnVpbGQnLFxuICAgIHRyZWVzaGFrZTogZmFsc2UsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgaW5wdXQsXG4gICAgICB0cmVlc2hha2U6IGZhbHNlXG4gICAgfVxuICB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBa1UsU0FBUyxvQkFBb0I7QUFDL1YsU0FBUyxlQUFlO0FBRHhCLElBQU0sbUNBQW1DO0FBSXpDLElBQU0sUUFBUTtBQUFBLEVBQ1o7QUFBQSxFQUFTO0FBQUEsRUFBVztBQUFBLEVBQU87QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQVk7QUFBQSxFQUMvRDtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBcUI7QUFBQSxFQUFlO0FBQUEsRUFDekQ7QUFBQSxFQUFRO0FBQUEsRUFBUztBQUFBLEVBQXNCO0FBQUEsRUFBMkI7QUFBQSxFQUFnQjtBQUFBLEVBQWlCO0FBQUEsRUFBNEI7QUFBQSxFQUFrQjtBQUFBLEVBQ2pKO0FBQUEsRUFBa0I7QUFBQSxFQUFXO0FBQUEsRUFBVTtBQUFBLEVBQVk7QUFBQSxFQUNuRDtBQUFBLEVBQWtCO0FBQUEsRUFBdUI7QUFBQSxF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

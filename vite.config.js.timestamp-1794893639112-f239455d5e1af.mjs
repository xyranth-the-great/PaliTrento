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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvcXVpcmt5LW5pY2UtYXJjaGltZWRlcy9tbnQvcGFsaXRyZW50bzJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9xdWlya3ktbmljZS1hcmNoaW1lZGVzL21udC9wYWxpdHJlbnRvMi92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvcXVpcmt5LW5pY2UtYXJjaGltZWRlcy9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnO1xuXG5jb25zdCBwYWdlcyA9IFtcbiAgJ2luZGV4JywgJ2V4cGxvcmUnLCAnbWFwJywgJ3Byb2R1Y3RzJywgJ2J1c2luZXNzJywgJ3JlZ2lzdGVyJywgJ2xvZ2luJyxcbiAgJ2FjY291bnQnLCAndmVyaWZ5JywgJ3JlZ2lzdGVyLWJ1c2luZXNzJywgJ3N0b3JlLXNldHVwJywgJ2Rhc2hib2FyZCcsXG4gICdjaGF0JywgJ2FkbWluJywgJ2FkbWluLXZlcmlmaWNhdGlvbicsICdhZG1pbi12ZXJpZmljYXRpb24tZG9jcycsICdhZG1pbi1wcmljZXMnLCAnYWRtaW4tcmVwb3J0cycsICdhZG1pbi1yZXBvcnRzLW1hbmFnZW1lbnQnLCAnYWRtaW4tYWNjb3VudHMnLCAnYWRtaW4tc3VwcG9ydCcsXG4gICdwcm9kdWN0LWRldGFpbCcsICdzdGFuZGVlJywgJ29yZGVycycsICdzZXR0aW5ncycsICdmb3Jnb3QtcGFzc3dvcmQnLFxuICAncmVzZXQtcGFzc3dvcmQnLCAndGVybXMtYW5kLWFncmVlbWVudCcsICdhZHZpc29yaWVzJywgJ3N1c3BlbmRlZCcsICdiYW5uZWQnLCAnYXV0aC1zdGF0dXMnLFxuICAncmVwb3J0LWJ1c2luZXNzJywgJ3JlcG9ydC1wcm9kdWN0JywgJ3N1cHBvcnQnXG5dO1xuXG4vLyBQYWdlcyB0aGF0IHNob3VsZCBiZSBkaXJlY3RvcmllcyAoY2xlYW4gVVJMcykgdnMgZmlsZXNcbmNvbnN0IGRpcmVjdG9yeVBhZ2VzID0gbmV3IFNldChbXG4gICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsXG4gICdhY2NvdW50JywgJ3ZlcmlmeScsICdyZWdpc3Rlci1idXNpbmVzcycsICdzdG9yZS1zZXR1cCcsICdkYXNoYm9hcmQnLFxuICAnY2hhdCcsICdhZG1pbicsICdhZG1pbi12ZXJpZmljYXRpb24nLCAnYWRtaW4tdmVyaWZpY2F0aW9uLWRvY3MnLCAnYWRtaW4tcHJpY2VzJywgJ2FkbWluLXJlcG9ydHMnLCAnYWRtaW4tcmVwb3J0cy1tYW5hZ2VtZW50JywgJ2FkbWluLWFjY291bnRzJywgJ2FkbWluLXN1cHBvcnQnLFxuICAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJyxcbiAgJ3Jlc2V0LXBhc3N3b3JkJywgJ3Rlcm1zLWFuZC1hZ3JlZW1lbnQnLCAnYWR2aXNvcmllcycsICdzdXNwZW5kZWQnLCAnYmFubmVkJywgJ2F1dGgtc3RhdHVzJyxcbiAgJ3JlcG9ydC1idXNpbmVzcycsICdyZXBvcnQtcHJvZHVjdCcsICdzdXBwb3J0J1xuXSk7XG5cbi8vIEJ1aWxkIGlucHV0IG9iamVjdCBmb3Igcm9sbHVwT3B0aW9uc1xuY29uc3QgaW5wdXQgPSB7fTtcbmZvciAoY29uc3QgcGFnZSBvZiBwYWdlcykge1xuICBpbnB1dFtwYWdlXSA9IHJlc29sdmUoX19kaXJuYW1lLCBgJHtwYWdlfS5odG1sYCk7XG59XG5cbi8vIERldiBtaWRkbGV3YXJlIHRvIHNlcnZlIGNsZWFuIFVSTHMgKGUuZy4sIC9leHBsb3JlLyAtPiBleHBsb3JlLmh0bWwpXG5mdW5jdGlvbiBjbGVhblVybHNEZXZNaWRkbGV3YXJlKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdjbGVhbi11cmxzLWRldicsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgICAgY29uc3QgdXJsID0gcmVxLnVybC5zcGxpdCgnPycpWzBdO1xuICAgICAgICAvLyBTa2lwIGlmIGFscmVhZHkgaGFzIGV4dGVuc2lvbiBvciBpcyBhc3NldC9hcGlcbiAgICAgICAgaWYgKHVybC5pbmNsdWRlcygnLicpIHx8IHVybC5zdGFydHNXaXRoKCcvQCcpIHx8IHVybC5zdGFydHNXaXRoKCcvYXBpLycpIHx8IHVybC5zdGFydHNXaXRoKCcvbm9kZV9tb2R1bGVzLycpKSB7XG4gICAgICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDaGVjayBpZiBpdCdzIGEgY2xlYW4gVVJMIHRoYXQgbWFwcyB0byBhIGRpcmVjdG9yeSBwYWdlXG4gICAgICAgIGNvbnN0IGNsZWFuUGF0aCA9IHVybC5yZXBsYWNlKC9eXFwvK3xcXC8rJC9nLCAnJyk7IC8vIHJlbW92ZSBsZWFkaW5nL3RyYWlsaW5nIHNsYXNoZXNcbiAgICAgICAgaWYgKGRpcmVjdG9yeVBhZ2VzLmhhcyhjbGVhblBhdGgpKSB7XG4gICAgICAgICAgcmVxLnVybCA9IGAvJHtjbGVhblBhdGh9Lmh0bWxgO1xuICAgICAgICB9XG4gICAgICAgIG5leHQoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbn1cblxuLy8gUGx1Z2luIHRvIHJlcGxhY2UgVkFQSUQga2V5IHBsYWNlaG9sZGVycyBhdCBidWlsZCB0aW1lXG5mdW5jdGlvbiByZXBsYWNlVmFwaWRLZXlzKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdyZXBsYWNlLXZhcGlkLWtleXMnLFxuICAgIHRyYW5zZm9ybShjb2RlLCBpZCkge1xuICAgICAgaWYgKGlkLmVuZHNXaXRoKCcuanMnKSB8fCBpZC5lbmRzV2l0aCgnLnRzJykpIHtcbiAgICAgICAgY29uc3QgdmFwaWRQdWJsaWNLZXkgPSBwcm9jZXNzLmVudi5WSVRFX1ZBUElEX1BVQkxJQ19LRVkgfHwgJyc7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKCd7e1ZBUElEX1BVQkxJQ19LRVl9fScpKSB7XG4gICAgICAgICAgcmV0dXJuIGNvZGUucmVwbGFjZSgve3tWQVBJRF9QVUJMSUNfS0VZfX0vZywgdmFwaWRQdWJsaWNLZXkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICB0cmFuc2Zvcm1JbmRleEh0bWwoaHRtbCkge1xuICAgICAgY29uc3QgdmFwaWRQdWJsaWNLZXkgPSBwcm9jZXNzLmVudi5WSVRFX1ZBUElEX1BVQkxJQ19LRVkgfHwgJyc7XG4gICAgICByZXR1cm4gaHRtbC5yZXBsYWNlKC97e1ZBUElEX1BVQkxJQ19LRVl9fS9nLCB2YXBpZFB1YmxpY0tleSk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBiYXNlOiAnLi8nLFxuICBwdWJsaWNEaXI6ICdwdWJsaWMnLFxuICBwbHVnaW5zOiBbY2xlYW5VcmxzRGV2TWlkZGxld2FyZSgpLCByZXBsYWNlVmFwaWRLZXlzKCldLFxuICBzZXJ2ZXI6IHtcbiAgICB3YXRjaDoge1xuICAgICAgaWdub3JlZDogWycqKi8ub2JzaWRpYW4tdmF1bHQvKionXVxuICAgIH0sXG4gICAgYWxsb3dlZEhvc3RzOiBbXG4gICAgICAndW5hYmFzaGVkLWhhbXBlci1jb3Nwb25zb3Iubmdyb2stZnJlZS5kZXYnLFxuICAgICAgJy5uZ3Jvay1mcmVlLmRldicsXG4gICAgICAnLm5ncm9rLWZyZWUuYXBwJyxcbiAgICAgICcubmdyb2suaW8nXG4gICAgXVxuICB9LFxuICBwcmV2aWV3OiB7XG4gICAgYWxsb3dlZEhvc3RzOiBbXG4gICAgICAndW5hYmFzaGVkLWhhbXBlci1jb3Nwb25zb3Iubmdyb2stZnJlZS5kZXYnLFxuICAgICAgJy5uZ3Jvay1mcmVlLmRldicsXG4gICAgICAnLm5ncm9rLWZyZWUuYXBwJyxcbiAgICAgICcubmdyb2suaW8nXG4gICAgXVxuICB9LFxuICBlc2J1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXMyMDIyJyxcbiAgICB0cmVlU2hha2luZzogZmFsc2VcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICB0YXJnZXQ6ICdlczIwMjInLFxuICAgIG91dERpcjogJy90bXAvcGFsaXRyZW50by1idWlsZCcsXG4gICAgdHJlZXNoYWtlOiBmYWxzZSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dCxcbiAgICAgIHRyZWVzaGFrZTogZmFsc2VcbiAgICB9XG4gIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFrVSxTQUFTLG9CQUFvQjtBQUMvVixTQUFTLGVBQWU7QUFEeEIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTSxRQUFRO0FBQUEsRUFDWjtBQUFBLEVBQVM7QUFBQSxFQUFXO0FBQUEsRUFBTztBQUFBLEVBQVk7QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQy9EO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFxQjtBQUFBLEVBQWU7QUFBQSxFQUN6RDtBQUFBLEVBQVE7QUFBQSxFQUFTO0FBQUEsRUFBc0I7QUFBQSxFQUEyQjtBQUFBLEVBQWdCO0FBQUEsRUFBaUI7QUFBQSxFQUE0QjtBQUFBLEVBQWtCO0FBQUEsRUFDako7QUFBQSxFQUFrQjtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBWTtBQUFBLEVBQ25EO0FBQUEsRUFBa0I7QUFBQSxFQUF1QjtBQUFBLEVBQWM7QUFBQSxFQUFhO0FBQUEsRUFBVTtBQUFBLEVBQzlFO0FBQUEsRUFBbUI7QUFBQSxFQUFrQjtB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

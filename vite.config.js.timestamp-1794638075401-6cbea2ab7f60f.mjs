// vite.config.js
import { defineConfig } from "file:///sessions/intelligent-awesome-hawking/mnt/palitrento2/node_modules/vite/dist/node/index.js";
import { resolve } from "node:path";
var __vite_injected_original_dirname = "/sessions/intelligent-awesome-hawking/mnt/palitrento2";
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
    target: "es2022"
  },
  build: {
    target: "es2022",
    outDir: "dist",
    rollupOptions: { input }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvaW50ZWxsaWdlbnQtYXdlc29tZS1oYXdraW5nL21udC9wYWxpdHJlbnRvMlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2ludGVsbGlnZW50LWF3ZXNvbWUtaGF3a2luZy9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2ludGVsbGlnZW50LWF3ZXNvbWUtaGF3a2luZy9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcclxuXHJcbmNvbnN0IHBhZ2VzID0gW1xyXG4gICdpbmRleCcsICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsXHJcbiAgJ2FjY291bnQnLCAndmVyaWZ5JywgJ3JlZ2lzdGVyLWJ1c2luZXNzJywgJ3N0b3JlLXNldHVwJywgJ2Rhc2hib2FyZCcsXHJcbiAgJ2NoYXQnLCAnYWRtaW4nLCAnYWRtaW4tdmVyaWZpY2F0aW9uJywgJ2FkbWluLXByaWNlcycsICdhZG1pbi1yZXBvcnRzJyxcclxuICAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJyxcclxuICAncmVzZXQtcGFzc3dvcmQnLCAndGVybXMtYW5kLWFncmVlbWVudCdcclxuXTtcclxuXHJcbi8vIFBhZ2VzIHRoYXQgc2hvdWxkIGJlIGRpcmVjdG9yaWVzIChjbGVhbiBVUkxzKSB2cyBmaWxlc1xyXG5jb25zdCBkaXJlY3RvcnlQYWdlcyA9IG5ldyBTZXQoW1xyXG4gICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsXHJcbiAgJ2FjY291bnQnLCAndmVyaWZ5JywgJ3JlZ2lzdGVyLWJ1c2luZXNzJywgJ3N0b3JlLXNldHVwJywgJ2Rhc2hib2FyZCcsXHJcbiAgJ2NoYXQnLCAnYWRtaW4nLCAnYWRtaW4tdmVyaWZpY2F0aW9uJywgJ2FkbWluLXByaWNlcycsICdhZG1pbi1yZXBvcnRzJyxcclxuICAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJyxcclxuICAncmVzZXQtcGFzc3dvcmQnLCAndGVybXMtYW5kLWFncmVlbWVudCdcclxuXSk7XHJcblxyXG4vLyBCdWlsZCBpbnB1dCBvYmplY3QgZm9yIHJvbGx1cE9wdGlvbnNcclxuY29uc3QgaW5wdXQgPSB7fTtcclxuZm9yIChjb25zdCBwYWdlIG9mIHBhZ2VzKSB7XHJcbiAgaW5wdXRbcGFnZV0gPSByZXNvbHZlKF9fZGlybmFtZSwgYCR7cGFnZX0uaHRtbGApO1xyXG59XHJcblxyXG4vLyBEZXYgbWlkZGxld2FyZSB0byBzZXJ2ZSBjbGVhbiBVUkxzIChlLmcuLCAvZXhwbG9yZS8gLT4gZXhwbG9yZS5odG1sKVxyXG5mdW5jdGlvbiBjbGVhblVybHNEZXZNaWRkbGV3YXJlKCkge1xyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiAnY2xlYW4tdXJscy1kZXYnLFxyXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xyXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKChyZXEsIHJlcywgbmV4dCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHVybCA9IHJlcS51cmwuc3BsaXQoJz8nKVswXTtcclxuICAgICAgICAvLyBTa2lwIGlmIGFscmVhZHkgaGFzIGV4dGVuc2lvbiBvciBpcyBhc3NldC9hcGlcclxuICAgICAgICBpZiAodXJsLmluY2x1ZGVzKCcuJykgfHwgdXJsLnN0YXJ0c1dpdGgoJy9AJykgfHwgdXJsLnN0YXJ0c1dpdGgoJy9hcGkvJykgfHwgdXJsLnN0YXJ0c1dpdGgoJy9ub2RlX21vZHVsZXMvJykpIHtcclxuICAgICAgICAgIHJldHVybiBuZXh0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIENoZWNrIGlmIGl0J3MgYSBjbGVhbiBVUkwgdGhhdCBtYXBzIHRvIGEgZGlyZWN0b3J5IHBhZ2VcclxuICAgICAgICBjb25zdCBjbGVhblBhdGggPSB1cmwucmVwbGFjZSgvXlxcLyt8XFwvKyQvZywgJycpOyAvLyByZW1vdmUgbGVhZGluZy90cmFpbGluZyBzbGFzaGVzXHJcbiAgICAgICAgaWYgKGRpcmVjdG9yeVBhZ2VzLmhhcyhjbGVhblBhdGgpKSB7XHJcbiAgICAgICAgICByZXEudXJsID0gYC8ke2NsZWFuUGF0aH0uaHRtbGA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG5leHQoKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfTtcclxufVxyXG5cclxuLy8gUGx1Z2luIHRvIHJlcGxhY2UgVkFQSUQga2V5IHBsYWNlaG9sZGVycyBhdCBidWlsZCB0aW1lXHJcbmZ1bmN0aW9uIHJlcGxhY2VWYXBpZEtleXMoKSB7XHJcbiAgcmV0dXJuIHtcclxuICAgIG5hbWU6ICdyZXBsYWNlLXZhcGlkLWtleXMnLFxyXG4gICAgdHJhbnNmb3JtKGNvZGUsIGlkKSB7XHJcbiAgICAgIGlmIChpZC5lbmRzV2l0aCgnLmpzJykgfHwgaWQuZW5kc1dpdGgoJy50cycpKSB7XHJcbiAgICAgICAgY29uc3QgdmFwaWRQdWJsaWNLZXkgPSBwcm9jZXNzLmVudi5WSVRFX1ZBUElEX1BVQkxJQ19LRVkgfHwgJyc7XHJcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoJ3t7VkFQSURfUFVCTElDX0tFWX19JykpIHtcclxuICAgICAgICAgIHJldHVybiBjb2RlLnJlcGxhY2UoL3t7VkFQSURfUFVCTElDX0tFWX19L2csIHZhcGlkUHVibGljS2V5KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgICB0cmFuc2Zvcm1JbmRleEh0bWwoaHRtbCkge1xyXG4gICAgICBjb25zdCB2YXBpZFB1YmxpY0tleSA9IHByb2Nlc3MuZW52LlZJVEVfVkFQSURfUFVCTElDX0tFWSB8fCAnJztcclxuICAgICAgcmV0dXJuIGh0bWwucmVwbGFjZSgve3tWQVBJRF9QVUJMSUNfS0VZfX0vZywgdmFwaWRQdWJsaWNLZXkpO1xyXG4gICAgfVxyXG4gIH07XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgYmFzZTogJy4vJyxcclxuICBwdWJsaWNEaXI6ICdwdWJsaWMnLFxyXG4gIHBsdWdpbnM6IFtjbGVhblVybHNEZXZNaWRkbGV3YXJlKCksIHJlcGxhY2VWYXBpZEtleXMoKV0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICB3YXRjaDoge1xyXG4gICAgICBpZ25vcmVkOiBbJyoqLy5vYnNpZGlhbi12YXVsdC8qKiddXHJcbiAgICB9LFxyXG4gICAgYWxsb3dlZEhvc3RzOiBbXHJcbiAgICAgICd1bmFiYXNoZWQtaGFtcGVyLWNvc3BvbnNvci5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuYXBwJyxcclxuICAgICAgJy5uZ3Jvay5pbydcclxuICAgIF1cclxuICB9LFxyXG4gIHByZXZpZXc6IHtcclxuICAgIGFsbG93ZWRIb3N0czogW1xyXG4gICAgICAndW5hYmFzaGVkLWhhbXBlci1jb3Nwb25zb3Iubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmFwcCcsXHJcbiAgICAgICcubmdyb2suaW8nXHJcbiAgICBdXHJcbiAgfSxcclxuICBlc2J1aWxkOiB7XHJcbiAgICB0YXJnZXQ6ICdlczIwMjInIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHRhcmdldDogJ2VzMjAyMicsXHJcbiAgICBvdXREaXI6ICdkaXN0JyxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHsgaW5wdXQgfVxyXG4gIH1cclxufSk7Il0sCiAgIm1hcHBpbmdzIjogIjtBQUFpVixTQUFTLG9CQUFvQjtBQUM5VyxTQUFTLGVBQWU7QUFEeEIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTSxRQUFRO0FBQUEsRUFDWjtBQUFBLEVBQVM7QUFBQSxFQUFXO0FBQUEsRUFBTztBQUFBLEVBQVk7QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQy9EO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFxQjtBQUFBLEVBQWU7QUFBQSxFQUN6RDtBQUFBLEVBQVE7QUFBQSxFQUFTO0FBQUEsRUFBc0I7QUFBQSxFQUFnQjtBQUFBLEVBQ3ZEO0FBQUEsRUFBa0I7QUFBQSxFQUFXO0FBQUEsRUFBVTtBQUFBLEVBQVk7QUFBQSxFQUNuRDtBQUFBLEVBQWtCO0FBQ3BCO0FBR0EsSUFBTSxpQkFBaUIsb0JBQUksSUFBSTtBQUFBLEVBQzdCO0FBQUEsRUFBVztBQUFBLEVBQU87QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQVk7QUFBQSxFQUN0RDtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBcUI7QUFBQSxFQUFlO0FBQUEsRUFDekQ7QUFBQSxFQUFRO0FBQUEsRUFBUztBQUFBLEVBQXNCO0FBQUEsRUFBZ0I7QUFBQSxFQUN2RDtBQUFBLEVBQWtCO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFZO0FBQUEsRUFDbkQ7QUFBQSxFQUFrQjtBQUNwQixDQUFDO0FBR0QsSUFBTSxRQUFRLENBQUM7QUFDZixXQUFXLFFBQVEsT0FBTztBQUN4QixRQUFNLElBQUksSUFBSSxRQUFRLGtDQUFXLEdBQUcsSUFBSSxPQUFPO0FBQ2pEO0FBR0EsU0FBUyx5QkFBeUI7QUFDaEMsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sZ0JBQWdCLFFBQVE7QUFDdEIsYUFBTyxZQUFZLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUztBQUN6QyxjQUFNLE1BQU0sSUFBSSxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFFaEMsWUFBSSxJQUFJLFNBQVMsR0FBRyxLQUFLLElBQUksV0FBVyxJQUFJLEtBQUssSUFBSSxXQUFXLE9BQU8sS0FBSyxJQUFJLFdBQVcsZ0JBQWdCLEdBQUc7QUFDNUcsaUJBQU8sS0FBSztBQUFBLFFBQ2Q7QUFFQSxjQUFNLFlBQVksSUFBSSxRQUFRLGNBQWMsRUFBRTtBQUM5QyxZQUFJLGVBQWUsSUFBSSxTQUFTLEdBQUc7QUFDakMsY0FBSSxNQUFNLElBQUksU0FBUztBQUFBLFFBQ3pCO0FBQ0EsYUFBSztBQUFBLE1BQ1AsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQ0Y7QUFHQSxTQUFTLG1CQUFtQjtBQUMxQixTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixVQUFVLE1BQU0sSUFBSTtBQUNsQixVQUFJLEdBQUcsU0FBUyxLQUFLLEtBQUssR0FBRyxTQUFTLEtBQUssR0FBRztBQUM1QyxjQUFNLGlCQUFpQixRQUFRLElBQUkseUJBQXlCO0FBQzVELFlBQUksS0FBSyxTQUFTLHNCQUFzQixHQUFHO0FBQ3pDLGlCQUFPLEtBQUssUUFBUSx5QkFBeUIsY0FBYztBQUFBLFFBQzdEO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLG1CQUFtQixNQUFNO0FBQ3ZCLFlBQU0saUJBQWlCLFFBQVEsSUFBSSx5QkFBeUI7QUFDNUQsYUFBTyxLQUFLLFFBQVEseUJBQXlCLGNBQWM7QUFBQSxJQUM3RDtBQUFBLEVBQ0Y7QUFDRjtBQUVBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLE1BQU07QUFBQSxFQUNOLFdBQVc7QUFBQSxFQUNYLFNBQVMsQ0FBQyx1QkFBdUIsR0FBRyxpQkFBaUIsQ0FBQztBQUFBLEVBQ3RELFFBQVE7QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFNBQVMsQ0FBQyx1QkFBdUI7QUFBQSxJQUNuQztBQUFBLElBQ0EsY0FBYztBQUFBLE1BQ1o7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsY0FBYztBQUFBLE1BQ1o7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsUUFBUTtBQUFBLEVBQVM7QUFBQSxFQUNuQixPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsSUFDUixlQUFlLEVBQUUsTUFBTTtBQUFBLEVBQ3pCO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K

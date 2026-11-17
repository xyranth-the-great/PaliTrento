// vite.config.js
import { defineConfig } from "file:///sessions/eager-adoring-dijkstra/mnt/palitrento2/node_modules/vite/dist/node/index.js";
import { resolve } from "node:path";
var __vite_injected_original_dirname = "/sessions/eager-adoring-dijkstra/mnt/palitrento2";
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
  "admin-accounts",
  "product-detail",
  "standee",
  "orders",
  "settings",
  "forgot-password",
  "reset-password",
  "terms-and-agreement",
  "advisories"
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
  "admin-accounts",
  "product-detail",
  "standee",
  "orders",
  "settings",
  "forgot-password",
  "reset-password",
  "terms-and-agreement",
  "advisories"
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZWFnZXItYWRvcmluZy1kaWprc3RyYS9tbnQvcGFsaXRyZW50bzJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9lYWdlci1hZG9yaW5nLWRpamtzdHJhL21udC9wYWxpdHJlbnRvMi92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvZWFnZXItYWRvcmluZy1kaWprc3RyYS9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcclxuXHJcbmNvbnN0IHBhZ2VzID0gW1xyXG4gICdpbmRleCcsICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsXHJcbiAgJ2FjY291bnQnLCAndmVyaWZ5JywgJ3JlZ2lzdGVyLWJ1c2luZXNzJywgJ3N0b3JlLXNldHVwJywgJ2Rhc2hib2FyZCcsXHJcbiAgJ2NoYXQnLCAnYWRtaW4nLCAnYWRtaW4tdmVyaWZpY2F0aW9uJywgJ2FkbWluLXByaWNlcycsICdhZG1pbi1yZXBvcnRzJywgJ2FkbWluLWFjY291bnRzJyxcclxuICAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJyxcclxuICAncmVzZXQtcGFzc3dvcmQnLCAndGVybXMtYW5kLWFncmVlbWVudCcsICdhZHZpc29yaWVzJ1xyXG5dO1xyXG5cclxuLy8gUGFnZXMgdGhhdCBzaG91bGQgYmUgZGlyZWN0b3JpZXMgKGNsZWFuIFVSTHMpIHZzIGZpbGVzXHJcbmNvbnN0IGRpcmVjdG9yeVBhZ2VzID0gbmV3IFNldChbXHJcbiAgJ2V4cGxvcmUnLCAnbWFwJywgJ3Byb2R1Y3RzJywgJ2J1c2luZXNzJywgJ3JlZ2lzdGVyJywgJ2xvZ2luJyxcclxuICAnYWNjb3VudCcsICd2ZXJpZnknLCAncmVnaXN0ZXItYnVzaW5lc3MnLCAnc3RvcmUtc2V0dXAnLCAnZGFzaGJvYXJkJyxcclxuICAnY2hhdCcsICdhZG1pbicsICdhZG1pbi12ZXJpZmljYXRpb24nLCAnYWRtaW4tcHJpY2VzJywgJ2FkbWluLXJlcG9ydHMnLCAnYWRtaW4tYWNjb3VudHMnLFxyXG4gICdwcm9kdWN0LWRldGFpbCcsICdzdGFuZGVlJywgJ29yZGVycycsICdzZXR0aW5ncycsICdmb3Jnb3QtcGFzc3dvcmQnLFxyXG4gICdyZXNldC1wYXNzd29yZCcsICd0ZXJtcy1hbmQtYWdyZWVtZW50JywgJ2Fkdmlzb3JpZXMnXHJcbl0pO1xyXG5cclxuLy8gQnVpbGQgaW5wdXQgb2JqZWN0IGZvciByb2xsdXBPcHRpb25zXHJcbmNvbnN0IGlucHV0ID0ge307XHJcbmZvciAoY29uc3QgcGFnZSBvZiBwYWdlcykge1xyXG4gIGlucHV0W3BhZ2VdID0gcmVzb2x2ZShfX2Rpcm5hbWUsIGAke3BhZ2V9Lmh0bWxgKTtcclxufVxyXG5cclxuLy8gRGV2IG1pZGRsZXdhcmUgdG8gc2VydmUgY2xlYW4gVVJMcyAoZS5nLiwgL2V4cGxvcmUvIC0+IGV4cGxvcmUuaHRtbClcclxuZnVuY3Rpb24gY2xlYW5VcmxzRGV2TWlkZGxld2FyZSgpIHtcclxuICByZXR1cm4ge1xyXG4gICAgbmFtZTogJ2NsZWFuLXVybHMtZGV2JyxcclxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcclxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcclxuICAgICAgICBjb25zdCB1cmwgPSByZXEudXJsLnNwbGl0KCc/JylbMF07XHJcbiAgICAgICAgLy8gU2tpcCBpZiBhbHJlYWR5IGhhcyBleHRlbnNpb24gb3IgaXMgYXNzZXQvYXBpXHJcbiAgICAgICAgaWYgKHVybC5pbmNsdWRlcygnLicpIHx8IHVybC5zdGFydHNXaXRoKCcvQCcpIHx8IHVybC5zdGFydHNXaXRoKCcvYXBpLycpIHx8IHVybC5zdGFydHNXaXRoKCcvbm9kZV9tb2R1bGVzLycpKSB7XHJcbiAgICAgICAgICByZXR1cm4gbmV4dCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBDaGVjayBpZiBpdCdzIGEgY2xlYW4gVVJMIHRoYXQgbWFwcyB0byBhIGRpcmVjdG9yeSBwYWdlXHJcbiAgICAgICAgY29uc3QgY2xlYW5QYXRoID0gdXJsLnJlcGxhY2UoL15cXC8rfFxcLyskL2csICcnKTsgLy8gcmVtb3ZlIGxlYWRpbmcvdHJhaWxpbmcgc2xhc2hlc1xyXG4gICAgICAgIGlmIChkaXJlY3RvcnlQYWdlcy5oYXMoY2xlYW5QYXRoKSkge1xyXG4gICAgICAgICAgcmVxLnVybCA9IGAvJHtjbGVhblBhdGh9Lmh0bWxgO1xyXG4gICAgICAgIH1cclxuICAgICAgICBuZXh0KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH07XHJcbn1cclxuXHJcbi8vIFBsdWdpbiB0byByZXBsYWNlIFZBUElEIGtleSBwbGFjZWhvbGRlcnMgYXQgYnVpbGQgdGltZVxyXG5mdW5jdGlvbiByZXBsYWNlVmFwaWRLZXlzKCkge1xyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiAncmVwbGFjZS12YXBpZC1rZXlzJyxcclxuICAgIHRyYW5zZm9ybShjb2RlLCBpZCkge1xyXG4gICAgICBpZiAoaWQuZW5kc1dpdGgoJy5qcycpIHx8IGlkLmVuZHNXaXRoKCcudHMnKSkge1xyXG4gICAgICAgIGNvbnN0IHZhcGlkUHVibGljS2V5ID0gcHJvY2Vzcy5lbnYuVklURV9WQVBJRF9QVUJMSUNfS0VZIHx8ICcnO1xyXG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKCd7e1ZBUElEX1BVQkxJQ19LRVl9fScpKSB7XHJcbiAgICAgICAgICByZXR1cm4gY29kZS5yZXBsYWNlKC97e1ZBUElEX1BVQkxJQ19LRVl9fS9nLCB2YXBpZFB1YmxpY0tleSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgdHJhbnNmb3JtSW5kZXhIdG1sKGh0bWwpIHtcclxuICAgICAgY29uc3QgdmFwaWRQdWJsaWNLZXkgPSBwcm9jZXNzLmVudi5WSVRFX1ZBUElEX1BVQkxJQ19LRVkgfHwgJyc7XHJcbiAgICAgIHJldHVybiBodG1sLnJlcGxhY2UoL3t7VkFQSURfUFVCTElDX0tFWX19L2csIHZhcGlkUHVibGljS2V5KTtcclxuICAgIH1cclxuICB9O1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIGJhc2U6ICcuLycsXHJcbiAgcHVibGljRGlyOiAncHVibGljJyxcclxuICBwbHVnaW5zOiBbY2xlYW5VcmxzRGV2TWlkZGxld2FyZSgpLCByZXBsYWNlVmFwaWRLZXlzKCldLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgd2F0Y2g6IHtcclxuICAgICAgaWdub3JlZDogWycqKi8ub2JzaWRpYW4tdmF1bHQvKionXVxyXG4gICAgfSxcclxuICAgIGFsbG93ZWRIb3N0czogW1xyXG4gICAgICAndW5hYmFzaGVkLWhhbXBlci1jb3Nwb25zb3Iubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmFwcCcsXHJcbiAgICAgICcubmdyb2suaW8nXHJcbiAgICBdXHJcbiAgfSxcclxuICBwcmV2aWV3OiB7XHJcbiAgICBhbGxvd2VkSG9zdHM6IFtcclxuICAgICAgJ3VuYWJhc2hlZC1oYW1wZXItY29zcG9uc29yLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5hcHAnLFxyXG4gICAgICAnLm5ncm9rLmlvJ1xyXG4gICAgXVxyXG4gIH0sXHJcbiAgZXNidWlsZDoge1xyXG4gICAgdGFyZ2V0OiAnZXMyMDIyJyB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICB0YXJnZXQ6ICdlczIwMjInLFxyXG4gICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7IGlucHV0IH1cclxuICB9XHJcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBa1UsU0FBUyxvQkFBb0I7QUFDL1YsU0FBUyxlQUFlO0FBRHhCLElBQU0sbUNBQW1DO0FBSXpDLElBQU0sUUFBUTtBQUFBLEVBQ1o7QUFBQSxFQUFTO0FBQUEsRUFBVztBQUFBLEVBQU87QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQVk7QUFBQSxFQUMvRDtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBcUI7QUFBQSxFQUFlO0FBQUEsRUFDekQ7QUFBQSxFQUFRO0FBQUEsRUFBUztBQUFBLEVBQXNCO0FBQUEsRUFBZ0I7QUFBQSxFQUFpQjtBQUFBLEVBQ3hFO0FBQUEsRUFBa0I7QUFBQSxFQUFXO0FBQUEsRUFBVTtBQUFBLEVBQVk7QUFBQSxFQUNuRDtBQUFBLEVBQWtCO0FBQUEsRUFBdUI7QUFDM0M7QUFHQSxJQUFNLGlCQUFpQixvQkFBSSxJQUFJO0FBQUEsRUFDN0I7QUFBQSxFQUFXO0FBQUEsRUFBTztBQUFBLEVBQVk7QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQ3REO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFxQjtBQUFBLEVBQWU7QUFBQSxFQUN6RDtBQUFBLEVBQVE7QUFBQSxFQUFTO0FBQUEsRUFBc0I7QUFBQSxFQUFnQjtBQUFBLEVBQWlCO0FBQUEsRUFDeEU7QUFBQSxFQUFrQjtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBWTtBQUFBLEVBQ25EO0FBQUEsRUFBa0I7QUFBQSxFQUF1QjtBQUMzQyxDQUFDO0FBR0QsSUFBTSxRQUFRLENBQUM7QUFDZixXQUFXLFFBQVEsT0FBTztBQUN4QixRQUFNLElBQUksSUFBSSxRQUFRLGtDQUFXLEdBQUcsSUFBSSxPQUFPO0FBQ2pEO0FBR0EsU0FBUyx5QkFBeUI7QUFDaEMsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sZ0JBQWdCLFFBQVE7QUFDdEIsYUFBTyxZQUFZLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUztBQUN6QyxjQUFNLE1BQU0sSUFBSSxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFFaEMsWUFBSSxJQUFJLFNBQVMsR0FBRyxLQUFLLElBQUksV0FBVyxJQUFJLEtBQUssSUFBSSxXQUFXLE9BQU8sS0FBSyxJQUFJLFdBQVcsZ0JBQWdCLEdBQUc7QUFDNUcsaUJBQU8sS0FBSztBQUFBLFFBQ2Q7QUFFQSxjQUFNLFlBQVksSUFBSSxRQUFRLGNBQWMsRUFBRTtBQUM5QyxZQUFJLGVBQWUsSUFBSSxTQUFTLEdBQUc7QUFDakMsY0FBSSxNQUFNLElBQUksU0FBUztBQUFBLFFBQ3pCO0FBQ0EsYUFBSztBQUFBLE1BQ1AsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQ0Y7QUFHQSxTQUFTLG1CQUFtQjtBQUMxQixTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixVQUFVLE1BQU0sSUFBSTtBQUNsQixVQUFJLEdBQUcsU0FBUyxLQUFLLEtBQUssR0FBRyxTQUFTLEtBQUssR0FBRztBQUM1QyxjQUFNLGlCQUFpQixRQUFRLElBQUkseUJBQXlCO0FBQzVELFlBQUksS0FBSyxTQUFTLHNCQUFzQixHQUFHO0FBQ3pDLGlCQUFPLEtBQUssUUFBUSx5QkFBeUIsY0FBYztBQUFBLFFBQzdEO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLG1CQUFtQixNQUFNO0FBQ3ZCLFlBQU0saUJBQWlCLFFBQVEsSUFBSSx5QkFBeUI7QUFDNUQsYUFBTyxLQUFLLFFBQVEseUJBQXlCLGNBQWM7QUFBQSxJQUM3RDtBQUFBLEVBQ0Y7QUFDRjtBQUVBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLE1BQU07QUFBQSxFQUNOLFdBQVc7QUFBQSxFQUNYLFNBQVMsQ0FBQyx1QkFBdUIsR0FBRyxpQkFBaUIsQ0FBQztBQUFBLEVBQ3RELFFBQVE7QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFNBQVMsQ0FBQyx1QkFBdUI7QUFBQSxJQUNuQztBQUFBLElBQ0EsY0FBYztBQUFBLE1BQ1o7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsY0FBYztBQUFBLE1BQ1o7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsUUFBUTtBQUFBLEVBQVM7QUFBQSxFQUNuQixPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsSUFDUixlQUFlLEVBQUUsTUFBTTtBQUFBLEVBQ3pCO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K

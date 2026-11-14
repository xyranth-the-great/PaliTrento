// vite.config.js
import { defineConfig } from "file:///sessions/busy-gracious-wozniak/mnt/palitrento2/node_modules/vite/dist/node/index.js";
import { resolve } from "node:path";
var __vite_injected_original_dirname = "/sessions/busy-gracious-wozniak/mnt/palitrento2";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYnVzeS1ncmFjaW91cy13b3puaWFrL21udC9wYWxpdHJlbnRvMlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2J1c3ktZ3JhY2lvdXMtd296bmlhay9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2J1c3ktZ3JhY2lvdXMtd296bmlhay9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcclxuXHJcbmNvbnN0IHBhZ2VzID0gW1xyXG4gICdpbmRleCcsICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsXHJcbiAgJ2FjY291bnQnLCAndmVyaWZ5JywgJ3JlZ2lzdGVyLWJ1c2luZXNzJywgJ3N0b3JlLXNldHVwJywgJ2Rhc2hib2FyZCcsXHJcbiAgJ2NoYXQnLCAnYWRtaW4nLCAnYWRtaW4tdmVyaWZpY2F0aW9uJywgJ2FkbWluLXByaWNlcycsICdhZG1pbi1yZXBvcnRzJyxcclxuICAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJyxcclxuICAncmVzZXQtcGFzc3dvcmQnLCAndGVybXMtYW5kLWFncmVlbWVudCcsICdhZHZpc29yaWVzJ1xyXG5dO1xyXG5cclxuLy8gUGFnZXMgdGhhdCBzaG91bGQgYmUgZGlyZWN0b3JpZXMgKGNsZWFuIFVSTHMpIHZzIGZpbGVzXHJcbmNvbnN0IGRpcmVjdG9yeVBhZ2VzID0gbmV3IFNldChbXHJcbiAgJ2V4cGxvcmUnLCAnbWFwJywgJ3Byb2R1Y3RzJywgJ2J1c2luZXNzJywgJ3JlZ2lzdGVyJywgJ2xvZ2luJyxcclxuICAnYWNjb3VudCcsICd2ZXJpZnknLCAncmVnaXN0ZXItYnVzaW5lc3MnLCAnc3RvcmUtc2V0dXAnLCAnZGFzaGJvYXJkJyxcclxuICAnY2hhdCcsICdhZG1pbicsICdhZG1pbi12ZXJpZmljYXRpb24nLCAnYWRtaW4tcHJpY2VzJywgJ2FkbWluLXJlcG9ydHMnLFxyXG4gICdwcm9kdWN0LWRldGFpbCcsICdzdGFuZGVlJywgJ29yZGVycycsICdzZXR0aW5ncycsICdmb3Jnb3QtcGFzc3dvcmQnLFxyXG4gICdyZXNldC1wYXNzd29yZCcsICd0ZXJtcy1hbmQtYWdyZWVtZW50JywgJ2Fkdmlzb3JpZXMnXHJcbl0pO1xyXG5cclxuLy8gQnVpbGQgaW5wdXQgb2JqZWN0IGZvciByb2xsdXBPcHRpb25zXHJcbmNvbnN0IGlucHV0ID0ge307XHJcbmZvciAoY29uc3QgcGFnZSBvZiBwYWdlcykge1xyXG4gIGlucHV0W3BhZ2VdID0gcmVzb2x2ZShfX2Rpcm5hbWUsIGAke3BhZ2V9Lmh0bWxgKTtcclxufVxyXG5cclxuLy8gRGV2IG1pZGRsZXdhcmUgdG8gc2VydmUgY2xlYW4gVVJMcyAoZS5nLiwgL2V4cGxvcmUvIC0+IGV4cGxvcmUuaHRtbClcclxuZnVuY3Rpb24gY2xlYW5VcmxzRGV2TWlkZGxld2FyZSgpIHtcclxuICByZXR1cm4ge1xyXG4gICAgbmFtZTogJ2NsZWFuLXVybHMtZGV2JyxcclxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcclxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcclxuICAgICAgICBjb25zdCB1cmwgPSByZXEudXJsLnNwbGl0KCc/JylbMF07XHJcbiAgICAgICAgLy8gU2tpcCBpZiBhbHJlYWR5IGhhcyBleHRlbnNpb24gb3IgaXMgYXNzZXQvYXBpXHJcbiAgICAgICAgaWYgKHVybC5pbmNsdWRlcygnLicpIHx8IHVybC5zdGFydHNXaXRoKCcvQCcpIHx8IHVybC5zdGFydHNXaXRoKCcvYXBpLycpIHx8IHVybC5zdGFydHNXaXRoKCcvbm9kZV9tb2R1bGVzLycpKSB7XHJcbiAgICAgICAgICByZXR1cm4gbmV4dCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBDaGVjayBpZiBpdCdzIGEgY2xlYW4gVVJMIHRoYXQgbWFwcyB0byBhIGRpcmVjdG9yeSBwYWdlXHJcbiAgICAgICAgY29uc3QgY2xlYW5QYXRoID0gdXJsLnJlcGxhY2UoL15cXC8rfFxcLyskL2csICcnKTsgLy8gcmVtb3ZlIGxlYWRpbmcvdHJhaWxpbmcgc2xhc2hlc1xyXG4gICAgICAgIGlmIChkaXJlY3RvcnlQYWdlcy5oYXMoY2xlYW5QYXRoKSkge1xyXG4gICAgICAgICAgcmVxLnVybCA9IGAvJHtjbGVhblBhdGh9Lmh0bWxgO1xyXG4gICAgICAgIH1cclxuICAgICAgICBuZXh0KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH07XHJcbn1cclxuXHJcbi8vIFBsdWdpbiB0byByZXBsYWNlIFZBUElEIGtleSBwbGFjZWhvbGRlcnMgYXQgYnVpbGQgdGltZVxyXG5mdW5jdGlvbiByZXBsYWNlVmFwaWRLZXlzKCkge1xyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiAncmVwbGFjZS12YXBpZC1rZXlzJyxcclxuICAgIHRyYW5zZm9ybShjb2RlLCBpZCkge1xyXG4gICAgICBpZiAoaWQuZW5kc1dpdGgoJy5qcycpIHx8IGlkLmVuZHNXaXRoKCcudHMnKSkge1xyXG4gICAgICAgIGNvbnN0IHZhcGlkUHVibGljS2V5ID0gcHJvY2Vzcy5lbnYuVklURV9WQVBJRF9QVUJMSUNfS0VZIHx8ICcnO1xyXG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKCd7e1ZBUElEX1BVQkxJQ19LRVl9fScpKSB7XHJcbiAgICAgICAgICByZXR1cm4gY29kZS5yZXBsYWNlKC97e1ZBUElEX1BVQkxJQ19LRVl9fS9nLCB2YXBpZFB1YmxpY0tleSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgdHJhbnNmb3JtSW5kZXhIdG1sKGh0bWwpIHtcclxuICAgICAgY29uc3QgdmFwaWRQdWJsaWNLZXkgPSBwcm9jZXNzLmVudi5WSVRFX1ZBUElEX1BVQkxJQ19LRVkgfHwgJyc7XHJcbiAgICAgIHJldHVybiBodG1sLnJlcGxhY2UoL3t7VkFQSURfUFVCTElDX0tFWX19L2csIHZhcGlkUHVibGljS2V5KTtcclxuICAgIH1cclxuICB9O1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIGJhc2U6ICcuLycsXHJcbiAgcHVibGljRGlyOiAncHVibGljJyxcclxuICBwbHVnaW5zOiBbY2xlYW5VcmxzRGV2TWlkZGxld2FyZSgpLCByZXBsYWNlVmFwaWRLZXlzKCldLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgd2F0Y2g6IHtcclxuICAgICAgaWdub3JlZDogWycqKi8ub2JzaWRpYW4tdmF1bHQvKionXVxyXG4gICAgfSxcclxuICAgIGFsbG93ZWRIb3N0czogW1xyXG4gICAgICAndW5hYmFzaGVkLWhhbXBlci1jb3Nwb25zb3Iubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmFwcCcsXHJcbiAgICAgICcubmdyb2suaW8nXHJcbiAgICBdXHJcbiAgfSxcclxuICBwcmV2aWV3OiB7XHJcbiAgICBhbGxvd2VkSG9zdHM6IFtcclxuICAgICAgJ3VuYWJhc2hlZC1oYW1wZXItY29zcG9uc29yLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5hcHAnLFxyXG4gICAgICAnLm5ncm9rLmlvJ1xyXG4gICAgXVxyXG4gIH0sXHJcbiAgZXNidWlsZDoge1xyXG4gICAgdGFyZ2V0OiAnZXMyMDIyJyB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICB0YXJnZXQ6ICdlczIwMjInLFxyXG4gICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7IGlucHV0IH1cclxuICB9XHJcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBK1QsU0FBUyxvQkFBb0I7QUFDNVYsU0FBUyxlQUFlO0FBRHhCLElBQU0sbUNBQW1DO0FBSXpDLElBQU0sUUFBUTtBQUFBLEVBQ1o7QUFBQSxFQUFTO0FBQUEsRUFBVztBQUFBLEVBQU87QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQVk7QUFBQSxFQUMvRDtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBcUI7QUFBQSxFQUFlO0FBQUEsRUFDekQ7QUFBQSxFQUFRO0FBQUEsRUFBUztBQUFBLEVBQXNCO0FBQUEsRUFBZ0I7QUFBQSxFQUN2RDtBQUFBLEVBQWtCO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFZO0FBQUEsRUFDbkQ7QUFBQSxFQUFrQjtBQUFBLEVBQXVCO0FBQzNDO0FBR0EsSUFBTSxpQkFBaUIsb0JBQUksSUFBSTtBQUFBLEVBQzdCO0FBQUEsRUFBVztBQUFBLEVBQU87QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQVk7QUFBQSxFQUN0RDtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBcUI7QUFBQSxFQUFlO0FBQUEsRUFDekQ7QUFBQSxFQUFRO0FBQUEsRUFBUztBQUFBLEVBQXNCO0FBQUEsRUFBZ0I7QUFBQSxFQUN2RDtBQUFBLEVBQWtCO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFZO0FBQUEsRUFDbkQ7QUFBQSxFQUFrQjtBQUFBLEVBQXVCO0FBQzNDLENBQUM7QUFHRCxJQUFNLFFBQVEsQ0FBQztBQUNmLFdBQVcsUUFBUSxPQUFPO0FBQ3hCLFFBQU0sSUFBSSxJQUFJLFFBQVEsa0NBQVcsR0FBRyxJQUFJLE9BQU87QUFDakQ7QUFHQSxTQUFTLHlCQUF5QjtBQUNoQyxTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixnQkFBZ0IsUUFBUTtBQUN0QixhQUFPLFlBQVksSUFBSSxDQUFDLEtBQUssS0FBSyxTQUFTO0FBQ3pDLGNBQU0sTUFBTSxJQUFJLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztBQUVoQyxZQUFJLElBQUksU0FBUyxHQUFHLEtBQUssSUFBSSxXQUFXLElBQUksS0FBSyxJQUFJLFdBQVcsT0FBTyxLQUFLLElBQUksV0FBVyxnQkFBZ0IsR0FBRztBQUM1RyxpQkFBTyxLQUFLO0FBQUEsUUFDZDtBQUVBLGNBQU0sWUFBWSxJQUFJLFFBQVEsY0FBYyxFQUFFO0FBQzlDLFlBQUksZUFBZSxJQUFJLFNBQVMsR0FBRztBQUNqQyxjQUFJLE1BQU0sSUFBSSxTQUFTO0FBQUEsUUFDekI7QUFDQSxhQUFLO0FBQUEsTUFDUCxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFDRjtBQUdBLFNBQVMsbUJBQW1CO0FBQzFCLFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLFVBQVUsTUFBTSxJQUFJO0FBQ2xCLFVBQUksR0FBRyxTQUFTLEtBQUssS0FBSyxHQUFHLFNBQVMsS0FBSyxHQUFHO0FBQzVDLGNBQU0saUJBQWlCLFFBQVEsSUFBSSx5QkFBeUI7QUFDNUQsWUFBSSxLQUFLLFNBQVMsc0JBQXNCLEdBQUc7QUFDekMsaUJBQU8sS0FBSyxRQUFRLHlCQUF5QixjQUFjO0FBQUEsUUFDN0Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsbUJBQW1CLE1BQU07QUFDdkIsWUFBTSxpQkFBaUIsUUFBUSxJQUFJLHlCQUF5QjtBQUM1RCxhQUFPLEtBQUssUUFBUSx5QkFBeUIsY0FBYztBQUFBLElBQzdEO0FBQUEsRUFDRjtBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsTUFBTTtBQUFBLEVBQ04sV0FBVztBQUFBLEVBQ1gsU0FBUyxDQUFDLHVCQUF1QixHQUFHLGlCQUFpQixDQUFDO0FBQUEsRUFDdEQsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsU0FBUyxDQUFDLHVCQUF1QjtBQUFBLElBQ25DO0FBQUEsSUFDQSxjQUFjO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxjQUFjO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxRQUFRO0FBQUEsRUFBUztBQUFBLEVBQ25CLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLGVBQWUsRUFBRSxNQUFNO0FBQUEsRUFDekI7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=

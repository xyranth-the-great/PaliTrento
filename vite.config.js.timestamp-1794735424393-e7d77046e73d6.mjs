// vite.config.js
import { defineConfig } from "file:///sessions/loving-compassionate-volta/mnt/palitrento2/node_modules/vite/dist/node/index.js";
import { resolve } from "node:path";
var __vite_injected_original_dirname = "/sessions/loving-compassionate-volta/mnt/palitrento2";
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
  "advisories",
  "suspended",
  "banned",
  "auth-status"
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
  "advisories",
  "suspended",
  "banned",
  "auth-status"
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvbG92aW5nLWNvbXBhc3Npb25hdGUtdm9sdGEvbW50L3BhbGl0cmVudG8yXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvc2Vzc2lvbnMvbG92aW5nLWNvbXBhc3Npb25hdGUtdm9sdGEvbW50L3BhbGl0cmVudG8yL3ZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9zZXNzaW9ucy9sb3ZpbmctY29tcGFzc2lvbmF0ZS12b2x0YS9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcclxuXHJcbmNvbnN0IHBhZ2VzID0gW1xyXG4gICdpbmRleCcsICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsXHJcbiAgJ2FjY291bnQnLCAndmVyaWZ5JywgJ3JlZ2lzdGVyLWJ1c2luZXNzJywgJ3N0b3JlLXNldHVwJywgJ2Rhc2hib2FyZCcsXHJcbiAgJ2NoYXQnLCAnYWRtaW4nLCAnYWRtaW4tdmVyaWZpY2F0aW9uJywgJ2FkbWluLXByaWNlcycsICdhZG1pbi1yZXBvcnRzJywgJ2FkbWluLWFjY291bnRzJyxcclxuICAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJyxcclxuICAncmVzZXQtcGFzc3dvcmQnLCAndGVybXMtYW5kLWFncmVlbWVudCcsICdhZHZpc29yaWVzJywgJ3N1c3BlbmRlZCcsICdiYW5uZWQnLCAnYXV0aC1zdGF0dXMnXHJcbl07XHJcblxyXG4vLyBQYWdlcyB0aGF0IHNob3VsZCBiZSBkaXJlY3RvcmllcyAoY2xlYW4gVVJMcykgdnMgZmlsZXNcclxuY29uc3QgZGlyZWN0b3J5UGFnZXMgPSBuZXcgU2V0KFtcclxuICAnZXhwbG9yZScsICdtYXAnLCAncHJvZHVjdHMnLCAnYnVzaW5lc3MnLCAncmVnaXN0ZXInLCAnbG9naW4nLFxyXG4gICdhY2NvdW50JywgJ3ZlcmlmeScsICdyZWdpc3Rlci1idXNpbmVzcycsICdzdG9yZS1zZXR1cCcsICdkYXNoYm9hcmQnLFxyXG4gICdjaGF0JywgJ2FkbWluJywgJ2FkbWluLXZlcmlmaWNhdGlvbicsICdhZG1pbi1wcmljZXMnLCAnYWRtaW4tcmVwb3J0cycsICdhZG1pbi1hY2NvdW50cycsXHJcbiAgJ3Byb2R1Y3QtZGV0YWlsJywgJ3N0YW5kZWUnLCAnb3JkZXJzJywgJ3NldHRpbmdzJywgJ2ZvcmdvdC1wYXNzd29yZCcsXHJcbiAgJ3Jlc2V0LXBhc3N3b3JkJywgJ3Rlcm1zLWFuZC1hZ3JlZW1lbnQnLCAnYWR2aXNvcmllcycsICdzdXNwZW5kZWQnLCAnYmFubmVkJywgJ2F1dGgtc3RhdHVzJ1xyXG5dKTtcclxuXHJcbi8vIEJ1aWxkIGlucHV0IG9iamVjdCBmb3Igcm9sbHVwT3B0aW9uc1xyXG5jb25zdCBpbnB1dCA9IHt9O1xyXG5mb3IgKGNvbnN0IHBhZ2Ugb2YgcGFnZXMpIHtcclxuICBpbnB1dFtwYWdlXSA9IHJlc29sdmUoX19kaXJuYW1lLCBgJHtwYWdlfS5odG1sYCk7XHJcbn1cclxuXHJcbi8vIERldiBtaWRkbGV3YXJlIHRvIHNlcnZlIGNsZWFuIFVSTHMgKGUuZy4sIC9leHBsb3JlLyAtPiBleHBsb3JlLmh0bWwpXHJcbmZ1bmN0aW9uIGNsZWFuVXJsc0Rldk1pZGRsZXdhcmUoKSB7XHJcbiAgcmV0dXJuIHtcclxuICAgIG5hbWU6ICdjbGVhbi11cmxzLWRldicsXHJcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XHJcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XHJcbiAgICAgICAgY29uc3QgdXJsID0gcmVxLnVybC5zcGxpdCgnPycpWzBdO1xyXG4gICAgICAgIC8vIFNraXAgaWYgYWxyZWFkeSBoYXMgZXh0ZW5zaW9uIG9yIGlzIGFzc2V0L2FwaVxyXG4gICAgICAgIGlmICh1cmwuaW5jbHVkZXMoJy4nKSB8fCB1cmwuc3RhcnRzV2l0aCgnL0AnKSB8fCB1cmwuc3RhcnRzV2l0aCgnL2FwaS8nKSB8fCB1cmwuc3RhcnRzV2l0aCgnL25vZGVfbW9kdWxlcy8nKSkge1xyXG4gICAgICAgICAgcmV0dXJuIG5leHQoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gQ2hlY2sgaWYgaXQncyBhIGNsZWFuIFVSTCB0aGF0IG1hcHMgdG8gYSBkaXJlY3RvcnkgcGFnZVxyXG4gICAgICAgIGNvbnN0IGNsZWFuUGF0aCA9IHVybC5yZXBsYWNlKC9eXFwvK3xcXC8rJC9nLCAnJyk7IC8vIHJlbW92ZSBsZWFkaW5nL3RyYWlsaW5nIHNsYXNoZXNcclxuICAgICAgICBpZiAoZGlyZWN0b3J5UGFnZXMuaGFzKGNsZWFuUGF0aCkpIHtcclxuICAgICAgICAgIHJlcS51cmwgPSBgLyR7Y2xlYW5QYXRofS5odG1sYDtcclxuICAgICAgICB9XHJcbiAgICAgICAgbmV4dCgpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9O1xyXG59XHJcblxyXG4vLyBQbHVnaW4gdG8gcmVwbGFjZSBWQVBJRCBrZXkgcGxhY2Vob2xkZXJzIGF0IGJ1aWxkIHRpbWVcclxuZnVuY3Rpb24gcmVwbGFjZVZhcGlkS2V5cygpIHtcclxuICByZXR1cm4ge1xyXG4gICAgbmFtZTogJ3JlcGxhY2UtdmFwaWQta2V5cycsXHJcbiAgICB0cmFuc2Zvcm0oY29kZSwgaWQpIHtcclxuICAgICAgaWYgKGlkLmVuZHNXaXRoKCcuanMnKSB8fCBpZC5lbmRzV2l0aCgnLnRzJykpIHtcclxuICAgICAgICBjb25zdCB2YXBpZFB1YmxpY0tleSA9IHByb2Nlc3MuZW52LlZJVEVfVkFQSURfUFVCTElDX0tFWSB8fCAnJztcclxuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcygne3tWQVBJRF9QVUJMSUNfS0VZfX0nKSkge1xyXG4gICAgICAgICAgcmV0dXJuIGNvZGUucmVwbGFjZSgve3tWQVBJRF9QVUJMSUNfS0VZfX0vZywgdmFwaWRQdWJsaWNLZXkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIHRyYW5zZm9ybUluZGV4SHRtbChodG1sKSB7XHJcbiAgICAgIGNvbnN0IHZhcGlkUHVibGljS2V5ID0gcHJvY2Vzcy5lbnYuVklURV9WQVBJRF9QVUJMSUNfS0VZIHx8ICcnO1xyXG4gICAgICByZXR1cm4gaHRtbC5yZXBsYWNlKC97e1ZBUElEX1BVQkxJQ19LRVl9fS9nLCB2YXBpZFB1YmxpY0tleSk7XHJcbiAgICB9XHJcbiAgfTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBiYXNlOiAnLi8nLFxyXG4gIHB1YmxpY0RpcjogJ3B1YmxpYycsXHJcbiAgcGx1Z2luczogW2NsZWFuVXJsc0Rldk1pZGRsZXdhcmUoKSwgcmVwbGFjZVZhcGlkS2V5cygpXSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHdhdGNoOiB7XHJcbiAgICAgIGlnbm9yZWQ6IFsnKiovLm9ic2lkaWFuLXZhdWx0LyoqJ11cclxuICAgIH0sXHJcbiAgICBhbGxvd2VkSG9zdHM6IFtcclxuICAgICAgJ3VuYWJhc2hlZC1oYW1wZXItY29zcG9uc29yLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5hcHAnLFxyXG4gICAgICAnLm5ncm9rLmlvJ1xyXG4gICAgXVxyXG4gIH0sXHJcbiAgcHJldmlldzoge1xyXG4gICAgYWxsb3dlZEhvc3RzOiBbXHJcbiAgICAgICd1bmFiYXNoZWQtaGFtcGVyLWNvc3BvbnNvci5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuYXBwJyxcclxuICAgICAgJy5uZ3Jvay5pbydcclxuICAgIF1cclxuICB9LFxyXG4gIGVzYnVpbGQ6IHtcclxuICAgIHRhcmdldDogJ2VzMjAyMicgfSxcclxuICBidWlsZDoge1xyXG4gICAgdGFyZ2V0OiAnZXMyMDIyJyxcclxuICAgIG91dERpcjogJ2Rpc3QnLFxyXG4gICAgcm9sbHVwT3B0aW9uczogeyBpbnB1dCB9XHJcbiAgfVxyXG59KTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQThVLFNBQVMsb0JBQW9CO0FBQzNXLFNBQVMsZUFBZTtBQUR4QixJQUFNLG1DQUFtQztBQUl6QyxJQUFNLFFBQVE7QUFBQSxFQUNaO0FBQUEsRUFBUztBQUFBLEVBQVc7QUFBQSxFQUFPO0FBQUEsRUFBWTtBQUFBLEVBQVk7QUFBQSxFQUFZO0FBQUEsRUFDL0Q7QUFBQSxFQUFXO0FBQUEsRUFBVTtBQUFBLEVBQXFCO0FBQUEsRUFBZTtBQUFBLEVBQ3pEO0FBQUEsRUFBUTtBQUFBLEVBQVM7QUFBQSxFQUFzQjtBQUFBLEVBQWdCO0FBQUEsRUFBaUI7QUFBQSxFQUN4RTtBQUFBLEVBQWtCO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFZO0FBQUEsRUFDbkQ7QUFBQSxFQUFrQjtBQUFBLEVBQXVCO0FBQUEsRUFBYztBQUFBLEVBQWE7QUFBQSxFQUFVO0FBQ2hGO0FBR0EsSUFBTSxpQkFBaUIsb0JBQUksSUFBSTtBQUFBLEVBQzdCO0FBQUEsRUFBVztBQUFBLEVBQU87QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQVk7QUFBQSxFQUN0RDtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBcUI7QUFBQSxFQUFlO0FBQUEsRUFDekQ7QUFBQSxFQUFRO0FBQUEsRUFBUztBQUFBLEVBQXNCO0FBQUEsRUFBZ0I7QUFBQSxFQUFpQjtBQUFBLEVBQ3hFO0FBQUEsRUFBa0I7QUFBQSxFQUFXO0FBQUEsRUFBVTtBQUFBLEVBQVk7QUFBQSxFQUNuRDtBQUFBLEVBQWtCO0FBQUEsRUFBdUI7QUFBQSxFQUFjO0FBQUEsRUFBYTtBQUFBLEVBQVU7QUFDaEYsQ0FBQztBQUdELElBQU0sUUFBUSxDQUFDO0FBQ2YsV0FBVyxRQUFRLE9BQU87QUFDeEIsUUFBTSxJQUFJLElBQUksUUFBUSxrQ0FBVyxHQUFHLElBQUksT0FBTztBQUNqRDtBQUdBLFNBQVMseUJBQXlCO0FBQ2hDLFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLGdCQUFnQixRQUFRO0FBQ3RCLGFBQU8sWUFBWSxJQUFJLENBQUMsS0FBSyxLQUFLLFNBQVM7QUFDekMsY0FBTSxNQUFNLElBQUksSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBRWhDLFlBQUksSUFBSSxTQUFTLEdBQUcsS0FBSyxJQUFJLFdBQVcsSUFBSSxLQUFLLElBQUksV0FBVyxPQUFPLEtBQUssSUFBSSxXQUFXLGdCQUFnQixHQUFHO0FBQzVHLGlCQUFPLEtBQUs7QUFBQSxRQUNkO0FBRUEsY0FBTSxZQUFZLElBQUksUUFBUSxjQUFjLEVBQUU7QUFDOUMsWUFBSSxlQUFlLElBQUksU0FBUyxHQUFHO0FBQ2pDLGNBQUksTUFBTSxJQUFJLFNBQVM7QUFBQSxRQUN6QjtBQUNBLGFBQUs7QUFBQSxNQUNQLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUNGO0FBR0EsU0FBUyxtQkFBbUI7QUFDMUIsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sVUFBVSxNQUFNLElBQUk7QUFDbEIsVUFBSSxHQUFHLFNBQVMsS0FBSyxLQUFLLEdBQUcsU0FBUyxLQUFLLEdBQUc7QUFDNUMsY0FBTSxpQkFBaUIsUUFBUSxJQUFJLHlCQUF5QjtBQUM1RCxZQUFJLEtBQUssU0FBUyxzQkFBc0IsR0FBRztBQUN6QyxpQkFBTyxLQUFLLFFBQVEseUJBQXlCLGNBQWM7QUFBQSxRQUM3RDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxtQkFBbUIsTUFBTTtBQUN2QixZQUFNLGlCQUFpQixRQUFRLElBQUkseUJBQXlCO0FBQzVELGFBQU8sS0FBSyxRQUFRLHlCQUF5QixjQUFjO0FBQUEsSUFDN0Q7QUFBQSxFQUNGO0FBQ0Y7QUFFQSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUEsRUFDTixXQUFXO0FBQUEsRUFDWCxTQUFTLENBQUMsdUJBQXVCLEdBQUcsaUJBQWlCLENBQUM7QUFBQSxFQUN0RCxRQUFRO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxTQUFTLENBQUMsdUJBQXVCO0FBQUEsSUFDbkM7QUFBQSxJQUNBLGNBQWM7QUFBQSxNQUNaO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLGNBQWM7QUFBQSxNQUNaO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLFFBQVE7QUFBQSxFQUFTO0FBQUEsRUFDbkIsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsUUFBUTtBQUFBLElBQ1IsZUFBZSxFQUFFLE1BQU07QUFBQSxFQUN6QjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==

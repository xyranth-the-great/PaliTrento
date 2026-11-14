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
  return {
    name: "move-html-to-directories",
    writeBundle() {
      for (const page of pages) {
        if (directoryPages.has(page)) {
          const src = resolve(__vite_injected_original_dirname, "dist", `${page}.html`);
          const destDir = resolve(__vite_injected_original_dirname, "dist", page);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZ2FsbGFudC1mb2N1c2VkLXBhc2NhbC9tbnQvcGFsaXRyZW50bzJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9nYWxsYW50LWZvY3VzZWQtcGFzY2FsL21udC9wYWxpdHJlbnRvMi92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvZ2FsbGFudC1mb2N1c2VkLXBhc2NhbC9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcclxuXHJcbmNvbnN0IHBhZ2VzID0gW1xyXG4gICdpbmRleCcsICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsXHJcbiAgJ2FjY291bnQnLCAndmVyaWZ5JywgJ3JlZ2lzdGVyLWJ1c2luZXNzJywgJ3N0b3JlLXNldHVwJywgJ2Rhc2hib2FyZCcsXHJcbiAgJ2NoYXQnLCAnYWRtaW4nLCAnYWRtaW4tdmVyaWZpY2F0aW9uJywgJ2FkbWluLXByaWNlcycsICdhZG1pbi1yZXBvcnRzJyxcclxuICAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJyxcclxuICAncmVzZXQtcGFzc3dvcmQnLCAndGVybXMtYW5kLWFncmVlbWVudCdcclxuXTtcclxuXHJcbi8vIFBhZ2VzIHRoYXQgc2hvdWxkIGJlIGRpcmVjdG9yaWVzIChjbGVhbiBVUkxzKSB2cyBmaWxlc1xyXG5jb25zdCBkaXJlY3RvcnlQYWdlcyA9IG5ldyBTZXQoW1xyXG4gICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsXHJcbiAgJ2FjY291bnQnLCAndmVyaWZ5JywgJ3JlZ2lzdGVyLWJ1c2luZXNzJywgJ3N0b3JlLXNldHVwJywgJ2Rhc2hib2FyZCcsXHJcbiAgJ2NoYXQnLCAnYWRtaW4nLCAnYWRtaW4tdmVyaWZpY2F0aW9uJywgJ2FkbWluLXByaWNlcycsICdhZG1pbi1yZXBvcnRzJyxcclxuICAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJyxcclxuICAncmVzZXQtcGFzc3dvcmQnLCAndGVybXMtYW5kLWFncmVlbWVudCdcclxuXSk7XHJcblxyXG4vLyBCdWlsZCBpbnB1dCBvYmplY3QgZm9yIHJvbGx1cE9wdGlvbnNcclxuY29uc3QgaW5wdXQgPSB7fTtcclxuZm9yIChjb25zdCBwYWdlIG9mIHBhZ2VzKSB7XHJcbiAgaW5wdXRbcGFnZV0gPSByZXNvbHZlKF9fZGlybmFtZSwgYCR7cGFnZX0uaHRtbGApO1xyXG59XHJcblxyXG4vLyBDdXN0b20gcGx1Z2luIHRvIG1vdmUgSFRNTCBmaWxlcyB0byBkaXJlY3Rvcnkgc3RydWN0dXJlIGFmdGVyIGJ1aWxkXHJcbmZ1bmN0aW9uIG1vdmVIdG1sVG9EaXJlY3RvcmllcygpIHtcclxuICByZXR1cm4ge1xyXG4gICAgbmFtZTogJ21vdmUtaHRtbC10by1kaXJlY3RvcmllcycsXHJcbiAgICB3cml0ZUJ1bmRsZSgpIHtcclxuICAgICAgZm9yIChjb25zdCBwYWdlIG9mIHBhZ2VzKSB7XHJcbiAgICAgICAgaWYgKGRpcmVjdG9yeVBhZ2VzLmhhcyhwYWdlKSkge1xyXG4gICAgICAgICAgY29uc3Qgc3JjID0gcmVzb2x2ZShfX2Rpcm5hbWUsICdkaXN0JywgYCR7cGFnZX0uaHRtbGApO1xyXG4gICAgICAgICAgY29uc3QgZGVzdERpciA9IHJlc29sdmUoX19kaXJuYW1lLCAnZGlzdCcsIHBhZ2UpO1xyXG4gICAgICAgICAgY29uc3QgZGVzdCA9IHJlc29sdmUoZGVzdERpciwgJ2luZGV4Lmh0bWwnKTtcclxuXHJcbiAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhzcmMpKSB7XHJcbiAgICAgICAgICAgIC8vIENyZWF0ZSBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxyXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZGVzdERpcikpIHtcclxuICAgICAgICAgICAgICBmcy5ta2RpclN5bmMoZGVzdERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gTW92ZSB0aGUgZmlsZVxyXG4gICAgICAgICAgICBmcy5yZW5hbWVTeW5jKHNyYywgZGVzdCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBNb3ZlZCAke3BhZ2V9Lmh0bWwgLT4gJHtwYWdlfS9pbmRleC5odG1sYCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBiYXNlOiAnLi8nLFxyXG4gIHB1YmxpY0RpcjogJ3B1YmxpYycsXHJcbiAgc2VydmVyOiB7XHJcbiAgICB3YXRjaDoge1xyXG4gICAgICBpZ25vcmVkOiBbJyoqLy5vYnNpZGlhbi12YXVsdC8qKiddXHJcbiAgICB9LFxyXG4gICAgYWxsb3dlZEhvc3RzOiBbXHJcbiAgICAgICd1bmFiYXNoZWQtaGFtcGVyLWNvc3BvbnNvci5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuYXBwJyxcclxuICAgICAgJy5uZ3Jvay5pbydcclxuICAgIF1cclxuICB9LFxyXG4gIHByZXZpZXc6IHtcclxuICAgIGFsbG93ZWRIb3N0czogW1xyXG4gICAgICAndW5hYmFzaGVkLWhhbXBlci1jb3Nwb25zb3Iubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmFwcCcsXHJcbiAgICAgICcubmdyb2suaW8nXHJcbiAgICBdXHJcbiAgfSxcclxuICBlc2J1aWxkOiB7XHJcbiAgICB0YXJnZXQ6ICdlczIwMjInIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHRhcmdldDogJ2VzMjAyMicsXHJcbiAgICBvdXREaXI6ICdkaXN0JyxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHsgaW5wdXQgfSxcclxuICAgIHBsdWdpbnM6IFttb3ZlSHRtbFRvRGlyZWN0b3JpZXMoKV1cclxuICB9XHJcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBa1UsU0FBUyxvQkFBb0I7QUFDL1YsU0FBUyxlQUFlO0FBQ3hCLE9BQU8sUUFBUTtBQUZmLElBQU0sbUNBQW1DO0FBSXpDLElBQU0sUUFBUTtBQUFBLEVBQ1o7QUFBQSxFQUFTO0FBQUEsRUFBVztBQUFBLEVBQU87QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQVk7QUFBQSxFQUMvRDtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBcUI7QUFBQSxFQUFlO0FBQUEsRUFDekQ7QUFBQSxFQUFRO0FBQUEsRUFBUztBQUFBLEVBQXNCO0FBQUEsRUFBZ0I7QUFBQSxFQUN2RDtBQUFBLEVBQWtCO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFZO0FBQUEsRUFDbkQ7QUFBQSxFQUFrQjtBQUNwQjtBQUdBLElBQU0saUJBQWlCLG9CQUFJLElBQUk7QUFBQSxFQUM3QjtBQUFBLEVBQVc7QUFBQSxFQUFPO0FBQUEsRUFBWTtBQUFBLEVBQVk7QUFBQSxFQUFZO0FBQUEsRUFDdEQ7QUFBQSxFQUFXO0FBQUEsRUFBVTtBQUFBLEVBQXFCO0FBQUEsRUFBZTtBQUFBLEVBQ3pEO0FBQUEsRUFBUTtBQUFBLEVBQVM7QUFBQSxFQUFzQjtBQUFBLEVBQWdCO0FBQUEsRUFDdkQ7QUFBQSxFQUFrQjtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBWTtBQUFBLEVBQ25EO0FBQUEsRUFBa0I7QUFDcEIsQ0FBQztBQUdELElBQU0sUUFBUSxDQUFDO0FBQ2YsV0FBVyxRQUFRLE9BQU87QUFDeEIsUUFBTSxJQUFJLElBQUksUUFBUSxrQ0FBVyxHQUFHLElBQUksT0FBTztBQUNqRDtBQUdBLFNBQVMsd0JBQXdCO0FBQy9CLFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFDWixpQkFBVyxRQUFRLE9BQU87QUFDeEIsWUFBSSxlQUFlLElBQUksSUFBSSxHQUFHO0FBQzVCLGdCQUFNLE1BQU0sUUFBUSxrQ0FBVyxRQUFRLEdBQUcsSUFBSSxPQUFPO0FBQ3JELGdCQUFNLFVBQVUsUUFBUSxrQ0FBVyxRQUFRLElBQUk7QUFDL0MsZ0JBQU0sT0FBTyxRQUFRLFNBQVMsWUFBWTtBQUUxQyxjQUFJLEdBQUcsV0FBVyxHQUFHLEdBQUc7QUFFdEIsZ0JBQUksQ0FBQyxHQUFHLFdBQVcsT0FBTyxHQUFHO0FBQzNCLGlCQUFHLFVBQVUsU0FBUyxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUEsWUFDM0M7QUFFQSxlQUFHLFdBQVcsS0FBSyxJQUFJO0FBQ3ZCLG9CQUFRLElBQUksU0FBUyxJQUFJLFlBQVksSUFBSSxhQUFhO0FBQUEsVUFDeEQ7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7QUFFQSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUEsRUFDTixXQUFXO0FBQUEsRUFDWCxRQUFRO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxTQUFTLENBQUMsdUJBQXVCO0FBQUEsSUFDbkM7QUFBQSxJQUNBLGNBQWM7QUFBQSxNQUNaO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLGNBQWM7QUFBQSxNQUNaO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLFFBQVE7QUFBQSxFQUFTO0FBQUEsRUFDbkIsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsUUFBUTtBQUFBLElBQ1IsZUFBZSxFQUFFLE1BQU07QUFBQSxJQUN2QixTQUFTLENBQUMsc0JBQXNCLENBQUM7QUFBQSxFQUNuQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==

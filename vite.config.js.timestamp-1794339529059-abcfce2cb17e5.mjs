// vite.config.js
import { defineConfig } from "file:///sessions/admiring-festive-gates/mnt/palitrento2/node_modules/vite/dist/node/index.js";
import { resolve } from "node:path";
var __vite_injected_original_dirname = "/sessions/admiring-festive-gates/mnt/palitrento2";
var pages = ["index", "explore", "map", "products", "business", "register", "login", "account", "verify", "register-business", "store-setup", "dashboard", "chat", "admin", "admin-verification", "admin-prices", "admin-reports", "product-detail", "standee", "orders"];
var vite_config_default = defineConfig({
  base: process.env.BASE_PATH || "./",
  publicDir: "public",
  server: {
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
    outDir: "dist-test",
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(__vite_injected_original_dirname, `${p}.html`)]))
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYWRtaXJpbmctZmVzdGl2ZS1nYXRlcy9tbnQvcGFsaXRyZW50bzJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9hZG1pcmluZy1mZXN0aXZlLWdhdGVzL21udC9wYWxpdHJlbnRvMi92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvYWRtaXJpbmctZmVzdGl2ZS1nYXRlcy9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcbmNvbnN0IHBhZ2VzID0gWydpbmRleCcsICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsICdhY2NvdW50JywgJ3ZlcmlmeScsICdyZWdpc3Rlci1idXNpbmVzcycsICdzdG9yZS1zZXR1cCcsICdkYXNoYm9hcmQnLCAnY2hhdCcsICdhZG1pbicsICdhZG1pbi12ZXJpZmljYXRpb24nLCAnYWRtaW4tcHJpY2VzJywgJ2FkbWluLXJlcG9ydHMnLCAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnXTtcclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBiYXNlOiBwcm9jZXNzLmVudi5CQVNFX1BBVEggfHwgJy4vJyxcclxuICBwdWJsaWNEaXI6ICdwdWJsaWMnLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgYWxsb3dlZEhvc3RzOiBbXHJcbiAgICAgICd1bmFiYXNoZWQtaGFtcGVyLWNvc3BvbnNvci5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuYXBwJyxcclxuICAgICAgJy5uZ3Jvay5pbydcclxuICAgIF1cclxuICB9LFxyXG4gIHByZXZpZXc6IHtcclxuICAgIGFsbG93ZWRIb3N0czogW1xyXG4gICAgICAndW5hYmFzaGVkLWhhbXBlci1jb3Nwb25zb3Iubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmFwcCcsXHJcbiAgICAgICcubmdyb2suaW8nXHJcbiAgICBdXHJcbiAgfSxcclxuICBlc2J1aWxkOiB7XHJcbiAgICB0YXJnZXQ6ICdlczIwMjInIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHRhcmdldDogJ2VzMjAyMicsXHJcbiAgICBvdXREaXI6ICdkaXN0LXRlc3QnLFxyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBpbnB1dDogT2JqZWN0LmZyb21FbnRyaWVzKHBhZ2VzLm1hcChwID0+IFtwLCByZXNvbHZlKF9fZGlybmFtZSwgYCR7cH0uaHRtbGApXSkpXHJcbiAgICB9XHJcbiAgfVxyXG59KTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQWtVLFNBQVMsb0JBQW9CO0FBQy9WLFNBQVMsZUFBZTtBQUR4QixJQUFNLG1DQUFtQztBQUV6QyxJQUFNLFFBQVEsQ0FBQyxTQUFTLFdBQVcsT0FBTyxZQUFZLFlBQVksWUFBWSxTQUFTLFdBQVcsVUFBVSxxQkFBcUIsZUFBZSxhQUFhLFFBQVEsU0FBUyxzQkFBc0IsZ0JBQWdCLGlCQUFpQixrQkFBa0IsV0FBVyxRQUFRO0FBQzFRLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLE1BQU0sUUFBUSxJQUFJLGFBQWE7QUFBQSxFQUMvQixXQUFXO0FBQUEsRUFDWCxRQUFRO0FBQUEsSUFDTixjQUFjO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxjQUFjO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxRQUFRO0FBQUEsRUFBUztBQUFBLEVBQ25CLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLE9BQU8sT0FBTyxZQUFZLE1BQU0sSUFBSSxPQUFLLENBQUMsR0FBRyxRQUFRLGtDQUFXLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQUEsSUFDaEY7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K

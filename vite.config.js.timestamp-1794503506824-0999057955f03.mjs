// vite.config.js
import { defineConfig } from "file:///sessions/compassionate-vigilant-allen/mnt/palitrento2/node_modules/vite/dist/node/index.js";
import { resolve } from "node:path";
var __vite_injected_original_dirname = "/sessions/compassionate-vigilant-allen/mnt/palitrento2";
var pages = ["index", "explore", "map", "products", "business", "register", "login", "account", "verify", "register-business", "store-setup", "dashboard", "chat", "admin", "admin-verification", "admin-prices", "admin-reports", "product-detail", "standee", "orders", "settings", "forgot-password", "reset-password"];
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
      input: Object.fromEntries(pages.map((p) => [p, resolve(__vite_injected_original_dirname, `${p}.html`)]))
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvY29tcGFzc2lvbmF0ZS12aWdpbGFudC1hbGxlbi9tbnQvcGFsaXRyZW50bzJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9jb21wYXNzaW9uYXRlLXZpZ2lsYW50LWFsbGVuL21udC9wYWxpdHJlbnRvMi92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvY29tcGFzc2lvbmF0ZS12aWdpbGFudC1hbGxlbi9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcbmNvbnN0IHBhZ2VzID0gWydpbmRleCcsICdleHBsb3JlJywgJ21hcCcsICdwcm9kdWN0cycsICdidXNpbmVzcycsICdyZWdpc3RlcicsICdsb2dpbicsICdhY2NvdW50JywgJ3ZlcmlmeScsICdyZWdpc3Rlci1idXNpbmVzcycsICdzdG9yZS1zZXR1cCcsICdkYXNoYm9hcmQnLCAnY2hhdCcsICdhZG1pbicsICdhZG1pbi12ZXJpZmljYXRpb24nLCAnYWRtaW4tcHJpY2VzJywgJ2FkbWluLXJlcG9ydHMnLCAncHJvZHVjdC1kZXRhaWwnLCAnc3RhbmRlZScsICdvcmRlcnMnLCAnc2V0dGluZ3MnLCAnZm9yZ290LXBhc3N3b3JkJywgJ3Jlc2V0LXBhc3N3b3JkJ107XHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgYmFzZTogJy4vJyxcclxuICBwdWJsaWNEaXI6ICdwdWJsaWMnLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgd2F0Y2g6IHtcclxuICAgICAgaWdub3JlZDogWycqKi8ub2JzaWRpYW4tdmF1bHQvKionXVxyXG4gICAgfSxcclxuICAgIGFsbG93ZWRIb3N0czogW1xyXG4gICAgICAndW5hYmFzaGVkLWhhbXBlci1jb3Nwb25zb3Iubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmFwcCcsXHJcbiAgICAgICcubmdyb2suaW8nXHJcbiAgICBdXHJcbiAgfSxcclxuICBwcmV2aWV3OiB7XHJcbiAgICBhbGxvd2VkSG9zdHM6IFtcclxuICAgICAgJ3VuYWJhc2hlZC1oYW1wZXItY29zcG9uc29yLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5hcHAnLFxyXG4gICAgICAnLm5ncm9rLmlvJ1xyXG4gICAgXVxyXG4gIH0sXHJcbiAgZXNidWlsZDoge1xyXG4gICAgdGFyZ2V0OiAnZXMyMDIyJyB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICB0YXJnZXQ6ICdlczIwMjInLFxyXG4gICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIGlucHV0OiBPYmplY3QuZnJvbUVudHJpZXMocGFnZXMubWFwKHAgPT4gW3AsIHJlc29sdmUoX19kaXJuYW1lLCBgJHtwfS5odG1sYCldKSlcclxuICAgIH1cclxuICB9XHJcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1YsU0FBUyxvQkFBb0I7QUFDalgsU0FBUyxlQUFlO0FBRHhCLElBQU0sbUNBQW1DO0FBRXpDLElBQU0sUUFBUSxDQUFDLFNBQVMsV0FBVyxPQUFPLFlBQVksWUFBWSxZQUFZLFNBQVMsV0FBVyxVQUFVLHFCQUFxQixlQUFlLGFBQWEsUUFBUSxTQUFTLHNCQUFzQixnQkFBZ0IsaUJBQWlCLGtCQUFrQixXQUFXLFVBQVUsWUFBWSxtQkFBbUIsZ0JBQWdCO0FBQzNULElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLE1BQU07QUFBQSxFQUNOLFdBQVc7QUFBQSxFQUNYLFFBQVE7QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFNBQVMsQ0FBQyx1QkFBdUI7QUFBQSxJQUNuQztBQUFBLElBQ0EsY0FBYztBQUFBLE1BQ1o7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsY0FBYztBQUFBLE1BQ1o7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsUUFBUTtBQUFBLEVBQVM7QUFBQSxFQUNuQixPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDYixPQUFPLE9BQU8sWUFBWSxNQUFNLElBQUksT0FBSyxDQUFDLEdBQUcsUUFBUSxrQ0FBVyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUFBLElBQ2hGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==

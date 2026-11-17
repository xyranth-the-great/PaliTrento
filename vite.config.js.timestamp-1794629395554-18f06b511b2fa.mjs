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
var input = {};
for (const page of pages) {
  const htmlPath = resolve(__vite_injected_original_dirname, `${page}.html`);
  if (directoryPages.has(page)) {
    input[page] = htmlPath;
  } else {
    input[page] = htmlPath;
  }
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
      input,
      output: {
        // Customize chunk and asset file names
        entryFileNames: (chunkInfo) => {
          const name = chunkInfo.name;
          if (directoryPages.has(name)) {
            return `${name}/index-[hash].js`;
          }
          return "index-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZ2FsbGFudC1mb2N1c2VkLXBhc2NhbC9tbnQvcGFsaXRyZW50bzJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9nYWxsYW50LWZvY3VzZWQtcGFzY2FsL21udC9wYWxpdHJlbnRvMi92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvZ2FsbGFudC1mb2N1c2VkLXBhc2NhbC9tbnQvcGFsaXRyZW50bzIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcblxyXG5jb25zdCBwYWdlcyA9IFtcclxuICAnaW5kZXgnLCAnZXhwbG9yZScsICdtYXAnLCAncHJvZHVjdHMnLCAnYnVzaW5lc3MnLCAncmVnaXN0ZXInLCAnbG9naW4nLFxyXG4gICdhY2NvdW50JywgJ3ZlcmlmeScsICdyZWdpc3Rlci1idXNpbmVzcycsICdzdG9yZS1zZXR1cCcsICdkYXNoYm9hcmQnLFxyXG4gICdjaGF0JywgJ2FkbWluJywgJ2FkbWluLXZlcmlmaWNhdGlvbicsICdhZG1pbi1wcmljZXMnLCAnYWRtaW4tcmVwb3J0cycsXHJcbiAgJ3Byb2R1Y3QtZGV0YWlsJywgJ3N0YW5kZWUnLCAnb3JkZXJzJywgJ3NldHRpbmdzJywgJ2ZvcmdvdC1wYXNzd29yZCcsXHJcbiAgJ3Jlc2V0LXBhc3N3b3JkJywgJ3Rlcm1zLWFuZC1hZ3JlZW1lbnQnXHJcbl07XHJcblxyXG4vLyBQYWdlcyB0aGF0IHNob3VsZCBiZSBkaXJlY3RvcmllcyAoY2xlYW4gVVJMcykgdnMgZmlsZXNcclxuY29uc3QgZGlyZWN0b3J5UGFnZXMgPSBuZXcgU2V0KFtcclxuICAnZXhwbG9yZScsICdtYXAnLCAncHJvZHVjdHMnLCAnYnVzaW5lc3MnLCAncmVnaXN0ZXInLCAnbG9naW4nLFxyXG4gICdhY2NvdW50JywgJ3ZlcmlmeScsICdyZWdpc3Rlci1idXNpbmVzcycsICdzdG9yZS1zZXR1cCcsICdkYXNoYm9hcmQnLFxyXG4gICdjaGF0JywgJ2FkbWluJywgJ2FkbWluLXZlcmlmaWNhdGlvbicsICdhZG1pbi1wcmljZXMnLCAnYWRtaW4tcmVwb3J0cycsXHJcbiAgJ3Byb2R1Y3QtZGV0YWlsJywgJ3N0YW5kZWUnLCAnb3JkZXJzJywgJ3NldHRpbmdzJywgJ2ZvcmdvdC1wYXNzd29yZCcsXHJcbiAgJ3Jlc2V0LXBhc3N3b3JkJywgJ3Rlcm1zLWFuZC1hZ3JlZW1lbnQnXHJcbl0pO1xyXG5cclxuLy8gQnVpbGQgaW5wdXQgb2JqZWN0IGZvciByb2xsdXBPcHRpb25zIC0gdXNlIHN0cmluZyBwYXRocywgbm90IG9iamVjdHNcclxuY29uc3QgaW5wdXQgPSB7fTtcclxuZm9yIChjb25zdCBwYWdlIG9mIHBhZ2VzKSB7XHJcbiAgY29uc3QgaHRtbFBhdGggPSByZXNvbHZlKF9fZGlybmFtZSwgYCR7cGFnZX0uaHRtbGApO1xyXG4gIGlmIChkaXJlY3RvcnlQYWdlcy5oYXMocGFnZSkpIHtcclxuICAgIC8vIEZvciBkaXJlY3RvcnkgcGFnZXMsIHdlJ2xsIHVzZSBhIGN1c3RvbSBvdXRwdXQgY29uZmlnXHJcbiAgICBpbnB1dFtwYWdlXSA9IGh0bWxQYXRoO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBpbnB1dFtwYWdlXSA9IGh0bWxQYXRoO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBiYXNlOiAnLi8nLFxyXG4gIHB1YmxpY0RpcjogJ3B1YmxpYycsXHJcbiAgc2VydmVyOiB7XHJcbiAgICB3YXRjaDoge1xyXG4gICAgICBpZ25vcmVkOiBbJyoqLy5vYnNpZGlhbi12YXVsdC8qKiddXHJcbiAgICB9LFxyXG4gICAgYWxsb3dlZEhvc3RzOiBbXHJcbiAgICAgICd1bmFiYXNoZWQtaGFtcGVyLWNvc3BvbnNvci5uZ3Jvay1mcmVlLmRldicsXHJcbiAgICAgICcubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuYXBwJyxcclxuICAgICAgJy5uZ3Jvay5pbydcclxuICAgIF1cclxuICB9LFxyXG4gIHByZXZpZXc6IHtcclxuICAgIGFsbG93ZWRIb3N0czogW1xyXG4gICAgICAndW5hYmFzaGVkLWhhbXBlci1jb3Nwb25zb3Iubmdyb2stZnJlZS5kZXYnLFxyXG4gICAgICAnLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay1mcmVlLmFwcCcsXHJcbiAgICAgICcubmdyb2suaW8nXHJcbiAgICBdXHJcbiAgfSxcclxuICBlc2J1aWxkOiB7XHJcbiAgICB0YXJnZXQ6ICdlczIwMjInIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHRhcmdldDogJ2VzMjAyMicsXHJcbiAgICBvdXREaXI6ICdkaXN0JyxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgaW5wdXQsXHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vIEN1c3RvbWl6ZSBjaHVuayBhbmQgYXNzZXQgZmlsZSBuYW1lc1xyXG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiAoY2h1bmtJbmZvKSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBuYW1lID0gY2h1bmtJbmZvLm5hbWU7XHJcbiAgICAgICAgICBpZiAoZGlyZWN0b3J5UGFnZXMuaGFzKG5hbWUpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBgJHtuYW1lfS9pbmRleC1baGFzaF0uanNgO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuICdpbmRleC1baGFzaF0uanMnO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY2h1bmtGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLVtoYXNoXS5qcycsXHJcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLVtoYXNoXS5bZXh0XSdcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufSk7Il0sCiAgIm1hcHBpbmdzIjogIjtBQUFrVSxTQUFTLG9CQUFvQjtBQUMvVixTQUFTLGVBQWU7QUFEeEIsSUFBTSxtQ0FBbUM7QUFHekMsSUFBTSxRQUFRO0FBQUEsRUFDWjtBQUFBLEVBQVM7QUFBQSxFQUFXO0FBQUEsRUFBTztBQUFBLEVBQVk7QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQy9EO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFxQjtBQUFBLEVBQWU7QUFBQSxFQUN6RDtBQUFBLEVBQVE7QUFBQSxFQUFTO0FBQUEsRUFBc0I7QUFBQSxFQUFnQjtBQUFBLEVBQ3ZEO0FBQUEsRUFBa0I7QUFBQSxFQUFXO0FBQUEsRUFBVTtBQUFBLEVBQVk7QUFBQSxFQUNuRDtBQUFBLEVBQWtCO0FBQ3BCO0FBR0EsSUFBTSxpQkFBaUIsb0JBQUksSUFBSTtBQUFBLEVBQzdCO0FBQUEsRUFBVztBQUFBLEVBQU87QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQVk7QUFBQSxFQUN0RDtBQUFBLEVBQVc7QUFBQSxFQUFVO0FBQUEsRUFBcUI7QUFBQSxFQUFlO0FBQUEsRUFDekQ7QUFBQSxFQUFRO0FBQUEsRUFBUztBQUFBLEVBQXNCO0FBQUEsRUFBZ0I7QUFBQSxFQUN2RDtBQUFBLEVBQWtCO0FBQUEsRUFBVztBQUFBLEVBQVU7QUFBQSxFQUFZO0FBQUEsRUFDbkQ7QUFBQSxFQUFrQjtBQUNwQixDQUFDO0FBR0QsSUFBTSxRQUFRLENBQUM7QUFDZixXQUFXLFFBQVEsT0FBTztBQUN4QixRQUFNLFdBQVcsUUFBUSxrQ0FBVyxHQUFHLElBQUksT0FBTztBQUNsRCxNQUFJLGVBQWUsSUFBSSxJQUFJLEdBQUc7QUFFNUIsVUFBTSxJQUFJLElBQUk7QUFBQSxFQUNoQixPQUFPO0FBQ0wsVUFBTSxJQUFJLElBQUk7QUFBQSxFQUNoQjtBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsTUFBTTtBQUFBLEVBQ04sV0FBVztBQUFBLEVBQ1gsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsU0FBUyxDQUFDLHVCQUF1QjtBQUFBLElBQ25DO0FBQUEsSUFDQSxjQUFjO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxjQUFjO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxRQUFRO0FBQUEsRUFBUztBQUFBLEVBQ25CLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiO0FBQUEsTUFDQSxRQUFRO0FBQUE7QUFBQSxRQUVOLGdCQUFnQixDQUFDLGNBQWM7QUFDN0IsZ0JBQU0sT0FBTyxVQUFVO0FBQ3ZCLGNBQUksZUFBZSxJQUFJLElBQUksR0FBRztBQUM1QixtQkFBTyxHQUFHLElBQUk7QUFBQSxVQUNoQjtBQUNBLGlCQUFPO0FBQUEsUUFDVDtBQUFBLFFBQ0EsZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsTUFDbEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==

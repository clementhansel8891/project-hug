import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8081,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@prisma/client": path.resolve(__dirname, "./src/core/persistence/prisma-mock.ts"),
      ".prisma/client/index-browser": path.resolve(__dirname, "./src/core/persistence/prisma-mock.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["@/core/persistence/storage/node"],
  },
  build: {
    // BUG-9 FIX: Code splitting for bundle size optimization
    rollupOptions: {
      output: {
        // Split vendor libraries into separate cacheable chunks
        manualChunks: {
          // React and related libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Charting libraries
          'charts': ['recharts'],
          // Utility libraries
          'utils': ['date-fns', 'uuid'],
        },
        // Set chunk size threshold (500 kB)
        chunkSizeWarningLimit: 600,
      },
    },
    // Set chunk size warning limit
    chunkSizeWarningLimit: 600,
  },
}));

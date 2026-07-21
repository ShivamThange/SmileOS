import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    // Dev proxy → the API server (spec §6.2 / T0.4). Keeps the browser same-origin
    // so the httpOnly refresh cookie flows without CORS preflight in dev.
    proxy: {
      "/api": { target: process.env.VITE_PROXY_TARGET || "http://localhost:4000", changeOrigin: true },
      "/webhooks": { target: process.env.VITE_PROXY_TARGET || "http://localhost:4000", changeOrigin: true },
      "/healthz": { target: process.env.VITE_PROXY_TARGET || "http://localhost:4000", changeOrigin: true },
      "/readyz": { target: process.env.VITE_PROXY_TARGET || "http://localhost:4000", changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the framework in its own long-lived chunk so app code and the
        // lazily-loaded public/patient surfaces cache independently of it.
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query", "zustand"],
        },
      },
    },
  },
});

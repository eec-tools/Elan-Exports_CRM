import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          const modulePath = id.split("node_modules/")[1];
          if (!modulePath) return "vendor";

          const parts = modulePath.split("/");
          const pkg = parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];

          if (["react", "react-dom", "scheduler"].includes(pkg)) {
            return "react-vendor";
          }

          if (["react-router", "react-router-dom", "@remix-run/router"].includes(pkg)) {
            return "router-vendor";
          }

          if (["@tanstack/react-query", "@tanstack/query-core"].includes(pkg)) {
            return "query-vendor";
          }

          if (["jspdf", "jspdf-autotable", "html2canvas", "html-to-image"].includes(pkg)) {
            return "pdf-vendor";
          }

          if (["recharts", "date-fns"].includes(pkg)) {
            return "charts-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

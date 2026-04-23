import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "react-i18next", "i18next", "framer-motion"],
  },
  // Pre-bundle heavy deps so dev server serves them as a single optimized chunk
  // instead of streaming hundreds of small ESM files (huge dev-time win).
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "recharts",
      "lucide-react",
      "date-fns",
      "date-fns/locale",
      "react-i18next",
      "i18next",
      "framer-motion",
      "sonner",
    ],
  },
  build: {
    // Split bundle so first paint downloads only the shell.
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "supabase": ["@supabase/supabase-js"],
          "recharts": ["recharts"],
          "icons": ["lucide-react"],
          "date-utils": ["date-fns"],
          "query": ["@tanstack/react-query"],
          "i18n": ["react-i18next", "i18next"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));

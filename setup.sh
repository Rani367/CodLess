#!/bin/bash
# Create directory structure
mkdir -p assets scripts src/modules src/utils src/components tests/unit tests/e2e public

# Create vite.config.js
cat > vite.config.js << "EOF"
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import viteCompression from "vite-plugin-compression";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  base: "/",
  
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    minify: "terser",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        offline: resolve(__dirname, "offline.html")
      }
    }
  },
  
  server: {
    port: 3000,
    host: true
  }
});
EOF

echo "✅ Basic setup complete"

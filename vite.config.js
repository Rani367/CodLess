import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import legacy from '@vitejs/plugin-legacy';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'assets/*.png', 'assets/*.jpg', 'robots.txt'],
      manifest: false, // We already have manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,glb}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
    legacy({
      targets: ['defaults', 'not IE 11']
    }),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true
    })
  ],
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['three'],
          'bluetooth': ['./src/modules/bluetooth.js'],
          'simulator': ['./src/modules/simulator.js'],
          'recorder': ['./src/modules/recorder.js']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 3000,
    open: true,
    https: true // Required for Bluetooth API
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
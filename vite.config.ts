import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'custom-sw.js',
      manifest: {
        name: 'Accademia Gallery Audio Guide',
        short_name: 'Accademia Guide',
        description: 'Audio guide for the Accademia Gallery in Florence',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'assets/images/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'assets/images/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'assets/images/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        injectionPoint: 'self.__WB_MANIFEST',
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,jpg,jpeg,mp3}'
        ],
        globIgnores: [
          'assets/images/pwa-192x192.png',
          'assets/images/pwa-512x512.png'
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 // 5MB
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      }
    })
  ]
})
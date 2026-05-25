import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Inject registration script automatically into index.html
      injectRegister: 'auto',
      workbox: {
        // Precache ALL build output — JS, CSS, HTML, fonts, icons
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
        // SPA fallback: any navigation request gets index.html from cache
        navigateFallback: '/index.html',
        // But never intercept /api/* — let those fail so the offline queue handles them
        navigateFallbackDenylist: [/^\/api\//],
        // Don't runtime-cache API responses — only precache build assets
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'ITTEK Solution',
        short_name: 'ITTEK',
        description: 'DAN & DOR SOLAR Business Management',
        theme_color: '#F97316',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
      },
      // Don't generate a dev SW — only in production build
      devOptions: { enabled: false },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})

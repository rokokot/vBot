import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Vinted Book Listing App',
        short_name: 'BookLister',
        description: 'Streamline your book listing workflow for Vinted',
        theme_color: '#42d6c5',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'vite.svg',
            sizes: '150x150',
            type: 'image/svg+xml'
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages',
      '@hooks': '/src/hooks',
      '@services': '/src/services',
      '@stores': '/src/stores',
      '@types': '/src/types',
      '@utils': '/src/utils'
    }
  },
  build: {
    rollupOptions: {
      input: {
        // Main React app
        main: resolve(__dirname, 'index.html'),
        // Chrome extension files
        popup: resolve(__dirname, 'src/extension/popup.html'),
        background: resolve(__dirname, 'src/extension/background.ts'),
        content: resolve(__dirname, 'src/extension/content.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep extension files in root for proper loading
          if (['background', 'content'].includes(chunkInfo.name)) {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173
  }
})
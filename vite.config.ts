// vite.config.ts - Enhanced configuration for both web app and extension
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs'

// Custom plugin to handle Chrome extension build
function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',
    writeBundle(options: any, bundle: any) {
      const outDir = options.dir || 'dist'
      
      // Create extension-specific manifest
      const manifest = {
        manifest_version: 3,
        name: 'Vinted Book Lister',
        version: '1.0.0',
        description: 'Streamline your book listing workflow for Vinted with automatic form filling',
        
        permissions: [
          'storage',
          'tabs',
          'activeTab',
          'scripting'
        ],
        
        host_permissions: [
          'https://vinted.com/*',
          'https://www.vinted.com/*',
          'https://*.vinted.com/*',
          'https://www.googleapis.com/*',
          'https://openlibrary.org/*'
        ],
        
        background: {
          service_worker: 'background.js',
          type: 'module'
        },
        
        content_scripts: [
          {
            matches: [
              'https://vinted.com/items/new*',
              'https://www.vinted.com/items/new*',
              'https://*.vinted.com/items/new*'
            ],
            js: ['content.js'],
            css: ['content.css'],
            run_at: 'document_end'
          }
        ],
        
        action: {
          default_popup: 'popup.html',
          default_title: 'Vinted Book Lister',
          default_icon: {
            '16': 'icons/icon16.png',
            '48': 'icons/icon48.png',
            '128': 'icons/icon128.png'
          }
        },
        
        icons: {
          '16': 'icons/icon16.png',
          '48': 'icons/icon48.png',
          '128': 'icons/icon128.png'
        },
        
        web_accessible_resources: [
          {
            resources: ['icons/*', 'assets/*'],
            matches: ['https://*.vinted.com/*']
          }
        ]
      }

      // Write manifest.json
      writeFileSync(
        resolve(outDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      )

      // Create popup.html for extension
      const popupHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vinted Book Lister</title>
  <style>
    body {
      width: 400px;
      height: 600px;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    #extension-root {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="extension-root"></div>
  <script type="module" src="popup.js"></script>
</body>
</html>`

      writeFileSync(resolve(outDir, 'popup.html'), popupHtml)

      // Create content.css for extension
      const contentCss = `
/* Vinted Book Lister Content Script Styles */
.vinted-autofilled {
  border: 2px solid #10b981 !important;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.3) !important;
  transition: all 0.3s ease !important;
}

#vinted-book-lister-indicator {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

@keyframes scanLine {
  0% { transform: translateY(-100%); }
  50% { transform: translateY(100%); }
  100% { transform: translateY(-100%); }
}

.scan-animation {
  animation: scanLine 2s ease-in-out infinite;
}

/* Message animations */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translate(-50%, -60%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}

.slide-in {
  animation: slideIn 0.3s ease-out;
}
`

      writeFileSync(resolve(outDir, 'content.css'), contentCss)

      console.log('✅ Chrome extension files generated successfully')
    }
  }
}

// Custom plugin to copy assets
function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    writeBundle() {
      const iconsDir = resolve('dist/icons')
      
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true })
      }

      // Copy or create placeholder icons
      const iconSizes = [16, 48, 128]
      iconSizes.forEach(size => {
        const iconPath = resolve(`public/icon${size}.png`)
        const destPath = resolve(`dist/icons/icon${size}.png`)
        
        if (existsSync(iconPath)) {
          copyFileSync(iconPath, destPath)
        } else {
          // Create a simple placeholder SVG converted to PNG would be better
          console.log(`⚠️  Icon ${size}x${size} not found, you should add it to public/`)
        }
      })
    }
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isDev = command === 'serve'
  const isExtension = env.VITE_BUILD_TARGET === 'extension'

  const baseConfig = {
    plugins: [
      react(),
      !isExtension && VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'vite.svg'],
        manifest: {
          name: 'Vinted Book Listing App',
          short_name: 'BookLister',
          description: 'Streamline your book listing workflow for Vinted',
          theme_color: '#14b8a6',
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
          enabled: isDev
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 5000000, // 5MB
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/www\.googleapis\.com\/books/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-books-api',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 86400 // 24 hours
                }
              }
            },
            {
              urlPattern: /^https:\/\/openlibrary\.org\/api/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'openlibrary-api',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 86400 // 24 hours
                }
              }
            }
          ]
        }
      }),
      chromeExtensionPlugin(),
      copyAssetsPlugin()
    ].filter(Boolean),

    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@components': resolve(__dirname, './src/components'),
        '@pages': resolve(__dirname, './src/pages'),
        '@hooks': resolve(__dirname, './src/hooks'),
        '@services': resolve(__dirname, './src/services'),
        '@stores': resolve(__dirname, './src/stores'),
        '@types': resolve(__dirname, './src/types'),
        '@utils': resolve(__dirname, './src/utils')
      }
    },

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __IS_EXTENSION__: JSON.stringify(isExtension)
    },

    server: {
      host: true,
      port: 5173,
      open: !isExtension,
      cors: true,
      headers: {
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Opener-Policy': 'same-origin'
      }
    },

    build: {
      outDir: 'dist',
      sourcemap: isDev,
      minify: !isDev,
      target: 'es2020',
      rollupOptions: {
        input: isExtension ? {
          popup: resolve(__dirname, 'src/extension-popup.tsx'),
          background: resolve(__dirname, 'src/extension/background.ts'),
          content: resolve(__dirname, 'src/extension/content.ts'),
        } : {
          main: resolve(__dirname, 'index.html')
        },
        output: {
          entryFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId || ''
            
            if (facadeModuleId.includes('background')) {
              return 'background.js'
            }
            if (facadeModuleId.includes('content')) {
              return 'content.js'
            }
            if (facadeModuleId.includes('popup') || facadeModuleId.includes('extension-popup')) {
              return 'popup.js'
            }
            
            return 'assets/[name]-[hash].js'
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.') || []
            const ext = info[info.length - 1]
            
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return 'assets/images/[name]-[hash][extname]'
            }
            if (/css/i.test(ext)) {
              return 'assets/css/[name]-[hash][extname]'
            }
            if (/woff2?|eot|ttf|otf/i.test(ext)) {
              return 'assets/fonts/[name]-[hash][extname]'
            }
            
            return 'assets/[name]-[hash][extname]'
          },
          manualChunks: !isExtension ? {
            vendor: ['react', 'react-dom'],
            database: ['dexie', 'dexie-react-hooks'],
            ui: ['lucide-react', '@headlessui/react'],
            utils: ['date-fns', 'clsx', 'tailwind-merge']
          } : undefined
        }
      },
      
      // Optimize for extension
      ...(isExtension && {
        cssCodeSplit: false,
        rollupOptions: {
          ...baseConfig.build?.rollupOptions,
          external: [],
          output: {
            ...baseConfig.build?.rollupOptions?.output,
            inlineDynamicImports: false
          }
        }
      })
    },

    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'zustand',
        'dexie',
        'lucide-react'
      ],
      exclude: isExtension ? ['chrome'] : []
    },

    esbuild: {
      drop: isDev ? [] : ['console', 'debugger'],
      legalComments: 'none'
    }
  }

  return baseConfig
})

// Additional package.json scripts for reference:
const additionalScripts = {
  "build:web": "vite build",
  "build:extension": "VITE_BUILD_TARGET=extension vite build",
  "build:all": "npm run build:web && npm run build:extension",
  "dev:extension": "VITE_BUILD_TARGET=extension vite build --watch",
  "preview:web": "vite preview",
  "zip:extension": "cd dist && zip -r ../vinted-book-lister-extension.zip .",
  "validate:extension": "web-ext lint --source-dir=dist",
  "test:extension": "web-ext run --source-dir=dist --browser-console"
}
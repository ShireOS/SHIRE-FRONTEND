import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'fs'
import { resolve } from 'path'

// SPA fallback for the owner console.
function ownerConsoleFallback() {
  return {
    name: 'owner-console-fallback',
    configureServer(server: any) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        const url = req.url || ''
        const accept = req.headers.accept || ''

        if (url === '/book') {
          req.url = '/book/index.html'
        } else if (url.startsWith('/book/') && accept.includes('text/html') && !url.includes('.')) {
          req.url = '/book/index.html'
        } else if (accept.includes('text/html') && !url.includes('.') && url !== '/') {
          req.url = '/index.html'
        }
        next()
      })
    },
  }
}

// Custom plugin to log API config on startup
function apiConfigLogger() {
  return {
    name: 'api-config-logger',
    configureServer() {
      // Load env vars
      const env = loadEnv('development', resolve(__dirname, '../..'), 'VITE_')

      const apiUrl = env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
      const useMock = env.VITE_USE_MOCK_DATA === 'true'
      const restaurantId = env.VITE_RESTAURANT_ID || 'default'

      console.log('')
      console.log('\x1b[44m\x1b[37m === SHIRE OWNER CONSOLE === \x1b[0m')
      console.log('\x1b[36m API Base URL:\x1b[0m', apiUrl)
      console.log('\x1b[36m Restaurant ID:\x1b[0m', restaurantId)
      console.log('\x1b[36m Mock Data Mode:\x1b[0m', useMock ? '\x1b[33mON (no API calls)\x1b[0m' : '\x1b[32mOFF (calling real API)\x1b[0m')
      console.log('')

      if (!useMock) {
        console.log('\x1b[33m ⚠️  Backend must be running at:\x1b[0m', apiUrl)
        console.log('\x1b[90m    If not running, set VITE_USE_MOCK_DATA=true in .env.development\x1b[0m')
        console.log('')
      } else {
        console.log('\x1b[32m ✓ Using mock data - no backend required\x1b[0m')
      }
      console.log('\x1b[44m\x1b[37m ========================= \x1b[0m')
      console.log('')
    }
  }
}

export default defineConfig(({ mode }) => {
  const rootEnvDir = resolve(__dirname, '../..')
  const bookEntry = resolve(__dirname, 'book/index.html')
  const env = loadEnv(mode, rootEnvDir, '')
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || ''
  const posApiProxyTarget =
    env.VITE_POS_API_PROXY_TARGET || 'https://shire-pos-api-production.up.railway.app'

  return {
    envDir: rootEnvDir,
    plugins: [react(), ownerConsoleFallback(), apiConfigLogger()],
    define: {
      __SHIRE_SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __SHIRE_SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(supabasePublishableKey),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@dashboard': resolve(__dirname, './src/dashboard'),
        '@shared': resolve(__dirname, './src/shared'),
      },
    },
    server: {
      proxy: {
        '/pos-api': {
          target: posApiProxyTarget,
          changeOrigin: true,
          secure: true,
          rewrite: path => path.replace(/^\/pos-api/, '/api/v1'),
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          ...(existsSync(bookEntry) ? { book: bookEntry } : {}),
        },
      },
    },
  }
})

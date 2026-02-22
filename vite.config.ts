import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// SPA fallback for multi-page app — serve each sub-app's index.html for all its routes
function mpaFallback() {
  return {
    name: 'mpa-fallback',
    configureServer(server: any) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        const url = req.url || ''
        const accept = req.headers.accept || ''

        // Only rewrite navigation requests (text/html), not JS/CSS/image assets
        if (accept.includes('text/html') && !url.endsWith('.html')) {
          if (url.startsWith('/fake-host-ui')) {
            req.url = '/host/index.html'
          } else if (url.startsWith('/fake-dashboard-demo')) {
            req.url = '/dashboard/index.html'
          } else if (url.startsWith('/dashboard')) {
            req.url = '/dashboard/index.html'
          } else if (url.startsWith('/host')) {
            req.url = '/host/index.html'
          }
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
      const env = loadEnv('development', process.cwd(), 'VITE_')

      const apiUrl = env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
      const useMock = env.VITE_USE_MOCK_DATA === 'true'
      const restaurantId = env.VITE_RESTAURANT_ID || 'default'

      console.log('')
      console.log('\x1b[44m\x1b[37m === SHIRE API CONFIG === \x1b[0m')
      console.log('\x1b[36m API Base URL:\x1b[0m', apiUrl)
      console.log('\x1b[36m Restaurant ID:\x1b[0m', restaurantId)
      console.log('\x1b[36m Mock Data Mode:\x1b[0m', useMock ? '\x1b[33mON (no API calls)\x1b[0m' : '\x1b[32mOFF (calling real API)\x1b[0m')
      console.log('')

      if (!useMock) {
        console.log('\x1b[33m ⚠️  Backend must be running at:\x1b[0m', apiUrl)
        console.log('\x1b[90m    If not running, set VITE_USE_MOCK_DATA=true in .env.development\x1b[0m')
        console.log('')
        console.log('\x1b[35m 📅 Scheduling Features:\x1b[0m')
        console.log('\x1b[90m    • Auto-selects "Mimosas" restaurant\x1b[0m')
        console.log('\x1b[90m    • AI schedule generation via /schedules/run\x1b[0m')
        console.log('\x1b[90m    • Coverage gap detection & labor tracking\x1b[0m')
      } else {
        console.log('\x1b[32m ✓ Using mock data - no backend required\x1b[0m')
      }
      console.log('\x1b[44m\x1b[37m ========================= \x1b[0m')
      console.log('')
    }
  }
}

export default defineConfig({
  plugins: [react(), mpaFallback(), apiConfigLogger()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@host': resolve(__dirname, './src/host'),
      '@dashboard': resolve(__dirname, './src/dashboard'),
      '@shared': resolve(__dirname, './src/shared'),
    },
  },
  server: {
    // Fix 416 errors for video files - ensure proper Range request handling
    headers: {
      'Accept-Ranges': 'bytes',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        host: resolve(__dirname, 'host/index.html'),
        dashboard: resolve(__dirname, 'dashboard/index.html'),
      },
    },
  },
})

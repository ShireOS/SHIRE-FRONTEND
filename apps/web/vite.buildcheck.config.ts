// Temporary compile-check config: builds only the main entry because the
// `book` entry in vite.config.ts references files missing from this checkout.
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const rootEnvDir = resolve(__dirname, '../..')
  const env = loadEnv(mode, rootEnvDir, '')
  return {
    envDir: rootEnvDir,
    plugins: [react()],
    define: {
      __SHIRE_SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''),
      __SHIRE_SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || '',
      ),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@dashboard': resolve(__dirname, './src/dashboard'),
        '@shared': resolve(__dirname, './src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: { main: resolve(__dirname, 'index.html') },
      },
      outDir: 'dist-buildcheck',
      emptyOutDir: true,
    },
  }
})

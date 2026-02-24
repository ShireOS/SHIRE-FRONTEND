/// <reference types="vite/client" />

// Environment variable types
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_USE_MOCK_DATA: string
  readonly VITE_RESTAURANT_ID: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __SHIRE_SUPABASE_URL__: string
declare const __SHIRE_SUPABASE_PUBLISHABLE_KEY__: string

declare module '*.css' {
  const content: string
  export default content
}

import { createClient } from '@supabase/supabase-js'

const PLACEHOLDER_SUPABASE_URL = 'https://your-project.supabase.co'
const PLACEHOLDER_SUPABASE_KEY = 'your-publishable-key-here'
const FALLBACK_SUPABASE_URL = 'https://invalid-project.supabase.co'
const FALLBACK_SUPABASE_KEY = 'sb_publishable_missing_key'

const normalizeEnvValue = (value: string | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const isPlaceholderValue = (value: string | null, placeholder: string): boolean =>
  value === placeholder

const supabaseUrl =
  normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL) ??
  normalizeEnvValue(__SHIRE_SUPABASE_URL__)
const supabasePublishableKey =
  normalizeEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ??
  normalizeEnvValue(__SHIRE_SUPABASE_PUBLISHABLE_KEY__)

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  !isPlaceholderValue(supabaseUrl, PLACEHOLDER_SUPABASE_URL) &&
  !isPlaceholderValue(supabasePublishableKey, PLACEHOLDER_SUPABASE_KEY)
)

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : '[Supabase] Missing/placeholder config. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Missing valid env config. Auth flows will show errors until VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set.'
  )
}

// Using 'any' for now - generate proper types with: npx supabase gen types typescript
export const supabase = createClient(
  supabaseUrl || FALLBACK_SUPABASE_URL,
  supabasePublishableKey || FALLBACK_SUPABASE_KEY,
  {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

// Debug logging in development
if (import.meta.env.DEV) {
  console.log(
    '%c[Supabase] Client initialized',
    'background: #3ECF8E; color: white; padding: 2px 6px; border-radius: 4px;',
    { url: isSupabaseConfigured ? 'configured' : 'MISSING' }
  )
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    '[Supabase] Missing required env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
  )
}

// Using 'any' for now - generate proper types with: npx supabase gen types typescript
export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
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
    { url: supabaseUrl ? 'configured' : 'MISSING' }
  )
}

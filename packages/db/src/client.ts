import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@shire/backend/schemas'

export interface InitOptions {
  url: string
  anonKey: string
}

let cached: SupabaseClient<Database> | null = null

export function initClient(opts: InitOptions): SupabaseClient<Database> {
  if (cached) return cached
  cached = createSupabaseClient<Database>(opts.url, opts.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  return cached
}

export function getClient(): SupabaseClient<Database> {
  if (!cached) {
    throw new Error(
      '@shire/db: call initClient() once at app startup before using getClient()',
    )
  }
  
  return cached
}

export function resetClient(): void {
  cached = null
}

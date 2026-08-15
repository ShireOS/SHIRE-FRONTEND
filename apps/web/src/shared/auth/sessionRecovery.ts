import { supabase, supabaseAuthStorageKey } from '../lib/supabase'
import { clearSessionAndRedirect } from './sessionRecoveryCore'

let recoveryPromise: Promise<void> | null = null

export function redirectForUnrecoverableSession(): Promise<void> {
  if (recoveryPromise) return recoveryPromise
  if (typeof window === 'undefined') return Promise.resolve()

  // A missing/revoked refresh token can make signOut fail before it clears
  // storage. Remove this project's stale browser session first.
  recoveryPromise = clearSessionAndRedirect({
    storage: window.localStorage,
    storageKey: supabaseAuthStorageKey,
    signOut: (options) => supabase.auth.signOut(options),
    redirect: () => window.location.replace('/auth/login?reason=session-ended'),
    onCleanupError: (error) => {
      console.warn('[Auth] Could not complete local session cleanup:', error)
    },
  })

  return recoveryPromise
}

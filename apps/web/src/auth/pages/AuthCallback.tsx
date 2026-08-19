import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../../shared/lib/supabase'
import type { EmailOtpType } from '@supabase/supabase-js'
import type { Restaurant } from '@shire/db'
import { isAbortError } from '../utils/authErrors'

const PENDING_INVITE_STORAGE_KEY = 'shire_pending_access_invite_token'
const PENDING_CLAIM_STORAGE_KEY = 'shire_pending_claim_token'

const SUPPORTED_EMAIL_OTP_TYPES: EmailOtpType[] = [
  'recovery',
  'invite',
  'email_change',
  'email',
]

let callbackProcessingPromise: Promise<void> | null = null

const getCompletedRestaurant = (
  currentRestaurant: Restaurant | null,
  restaurants: Restaurant[]
): Restaurant | null => {
  if (currentRestaurant?.onboarding_completed_at) {
    return currentRestaurant
  }

  return restaurants.find(restaurant => Boolean(restaurant.onboarding_completed_at)) ?? null
}

function normalizeEmailOtpType(value: string | null): EmailOtpType | null {
  if (!value) return null

  // Backward-compat for legacy link types that still appear in old emails.
  if (value === 'signup' || value === 'magiclink') {
    return 'email'
  }

  if (SUPPORTED_EMAIL_OTP_TYPES.includes(value as EmailOtpType)) {
    return value as EmailOtpType
  }

  return null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function isMissingPkceVerifierError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes('pkce') && message.includes('code verifier') && message.includes('not found')
}

async function processCallbackUrl(): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error(supabaseConfigError || 'Authentication is not configured.')
  }

  const url = new URL(window.location.href)
  const errorDescription = url.searchParams.get('error_description') || url.searchParams.get('error')
  if (errorDescription) {
    throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')))
  }

  const code = url.searchParams.get('code')
  if (code) {
    const {
      data: { session: existingSession },
      error: existingSessionError,
    } = await supabase.auth.getSession()

    if (existingSessionError) {
      throw existingSessionError
    }

    if (!existingSession) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        if (!isMissingPkceVerifierError(error)) {
          throw error
        }

        // In development Strict Mode, callback effects can double-run.
        // If first run already exchanged the code, keep going when session exists.
        const {
          data: { session: recoveredSession },
          error: recoveredSessionError,
        } = await supabase.auth.getSession()

        if (recoveredSessionError) {
          throw recoveredSessionError
        }

        if (!recoveredSession) {
          throw error
        }

        console.warn('[AuthCallback] PKCE verifier missing after code exchange retry; continuing with active session.')
      }
    }
  }

  const tokenHash = url.searchParams.get('token_hash')
  const normalizedType = normalizeEmailOtpType(url.searchParams.get('type'))

  if (tokenHash && normalizedType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: normalizedType,
    })
    if (error) throw error
  }

  window.history.replaceState({}, document.title, window.location.pathname)
}

function runCallbackFlowOnce(): Promise<void> {
  if (!callbackProcessingPromise) {
    callbackProcessingPromise = processCallbackUrl().finally(() => {
      callbackProcessingPromise = null
    })
  }

  return callbackProcessingPromise
}

/**
 * Handles OAuth callbacks and email verification links
 * Routes: /auth/callback
 */
export function AuthCallbackPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [isProcessingCallback, setIsProcessingCallback] = useState(true)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const redirectedRef = useRef(false)
  const completedRestaurant = getCompletedRestaurant(
    auth.restaurant.currentRestaurant,
    auth.restaurant.restaurants
  )

  useEffect(() => {
    let mounted = true

    const processCallback = async () => {
      try {
        await runCallbackFlowOnce()
      } catch (error) {
        if (isAbortError(error)) {
          // Transient race during callback/session exchange. Let auth context settle.
          console.warn('[AuthCallback] Callback processing aborted, waiting for auth state.')
        } else {
          console.error('[AuthCallback] Callback processing failed:', error)
          if (mounted) {
            setFatalError(error instanceof Error ? error.message : 'Authentication failed')
          }
        }
      } finally {
        if (mounted) {
          setIsProcessingCallback(false)
        }
      }
    }

    void processCallback()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (redirectedRef.current) return
    if (fatalError) return
    if (isProcessingCallback || auth.isLoading || auth.restaurant.isLoading) return

    redirectedRef.current = true

    if (!auth.isAuthenticated) {
      navigate('/auth/login', { replace: true })
      return
    }

    const pendingInvite = localStorage.getItem(PENDING_INVITE_STORAGE_KEY)
    if (pendingInvite) {
      navigate(`/invite?token=${encodeURIComponent(pendingInvite)}`, { replace: true })
      return
    }

    const pendingClaim = localStorage.getItem(PENDING_CLAIM_STORAGE_KEY)
    if (pendingClaim) {
      navigate(`/claim/${encodeURIComponent(pendingClaim)}`, { replace: true })
      return
    }

    if (completedRestaurant) {
      if (auth.restaurant.currentRestaurant?.id !== completedRestaurant.id) {
        void auth.switchRestaurant(completedRestaurant.id)
      }
      navigate('/', { replace: true })
      return
    }

    navigate('/onboarding', { replace: true })
  }, [
    fatalError,
    isProcessingCallback,
    auth.isLoading,
    auth.isAuthenticated,
    auth.restaurant.isLoading,
    auth.restaurant.currentRestaurant,
    auth.restaurant.restaurants,
    auth.switchRestaurant,
    completedRestaurant,
    navigate,
  ])

  if (fatalError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="auth-display text-xl text-[rgb(var(--text-primary))] mb-2">Authentication Error</h2>
          <p className="text-[rgb(var(--text-tertiary))] mb-6">{fatalError}</p>
          <button
            onClick={() => navigate('/auth/login', { replace: true })}
            className="px-6 py-2 bg-white text-black hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#d4a854] mx-auto mb-4" />
        <p className="text-[rgb(var(--text-tertiary))]">Completing authentication...</p>
      </div>
    </div>
  )
}

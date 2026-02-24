import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { useAuth } from '../context/AuthContext'
import { isAbortError } from '../utils/authErrors'
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../../shared/lib/supabase'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function parseHashParams(hash: string): URLSearchParams {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash
  return new URLSearchParams(normalizedHash)
}

export function ResetPasswordPage() {
  const { updatePassword, isAuthenticated, isLoading: isAuthLoading } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const submitDisabled = useMemo(
    () => isInitializing || isSubmitting || isSuccess,
    [isInitializing, isSubmitting, isSuccess]
  )

  useEffect(() => {
    let mounted = true

    const initializeResetSession = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) {
          setError(supabaseConfigError || 'Authentication is not configured.')
          setIsInitializing(false)
        }
        return
      }

      try {
        const url = new URL(window.location.href)
        const hashParams = parseHashParams(window.location.hash)

        const errorDescription =
          url.searchParams.get('error_description') ||
          url.searchParams.get('error') ||
          hashParams.get('error_description') ||
          hashParams.get('error')

        if (errorDescription) {
          throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')))
        }

        const code = url.searchParams.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        }

        const tokenHash = url.searchParams.get('token_hash')
        const otpType = url.searchParams.get('type')

        if (tokenHash && otpType === 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          })
          if (verifyError) throw verifyError
        }

        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessionError) throw sessionError
        }

        window.history.replaceState({}, document.title, window.location.pathname)
      } catch (err) {
        if (!isAbortError(err) && mounted) {
          console.error('[ResetPassword] Failed to initialize recovery session:', err)
          setError(getErrorMessage(err))
        }
      } finally {
        if (mounted) {
          setIsInitializing(false)
        }
      }
    }

    void initializeResetSession()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (isInitializing || isAuthLoading || error || isSuccess) return
    if (!isAuthenticated) {
      setError('This reset link is invalid or expired. Request a new password reset email.')
    }
  }, [isAuthenticated, isAuthLoading, isInitializing, error, isSuccess])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)

    const result = await updatePassword(password)
    if (!result.success) {
      setError(result.error || 'Failed to update password')
      setIsSubmitting(false)
      return
    }

    setIsSuccess(true)
    setIsSubmitting(false)
  }

  if (isSuccess) {
    return (
      <AuthLayout title="Password updated" subtitle="Your account is ready to use">
        <div className="text-center space-y-6">
          <p className="text-[rgb(var(--text-secondary))]">
            Your password has been updated successfully.
          </p>
          <Link
            to="/auth/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-100 transition-colors"
          >
            Continue to login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password for your account"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="password" className="label-mono block mb-2">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitDisabled}
            className="block w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all disabled:opacity-60"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label-mono block mb-2">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitDisabled}
            className="block w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all disabled:opacity-60"
            placeholder="Re-enter your new password"
          />
        </div>

        <button
          type="submit"
          disabled={submitDisabled || !isAuthenticated}
          className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[rgba(212,168,84,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isInitializing ? 'Validating reset link...' : isSubmitting ? 'Updating password...' : 'Update password'}
        </button>

        <p className="text-center text-sm text-[rgb(var(--text-secondary))]">
          Back to{' '}
          <Link to="/auth/login" className="text-[#d4a854] hover:text-[rgb(var(--gold))] font-medium transition-colors">
            login
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}

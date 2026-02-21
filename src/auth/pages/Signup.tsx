import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRedirectIfAuthenticated } from '../hooks/useRequireAuth'
import { AuthLayout } from '../components/AuthLayout'
import { SocialLogin } from '../components/SocialLogin'

export function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth()
  const { isReady } = useRedirectIfAuthenticated()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setIsLoading(false)
      return
    }

    const result = await signUp(email, password, {
      first_name: firstName,
      last_name: lastName,
    })

    if (!result.success) {
      setError(result.error || 'Failed to create account')
    } else {
      setEmailSent(true)
    }

    setIsLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setIsLoading(true)

    const result = await signInWithGoogle()

    if (!result.success) {
      setError(result.error || 'Failed to sign in with Google')
      setIsLoading(false)
    }
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#d4a854]" />
      </div>
    )
  }

  if (emailSent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent you a verification link"
      >
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-[rgba(201,169,98,0.1)] rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-[rgb(var(--gold))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <div>
            <p className="text-[rgb(var(--text-secondary))]">
              We've sent a verification email to:
            </p>
            <p className="text-[rgb(var(--text-primary))] font-medium mt-1">{email}</p>
          </div>

          <p className="text-[rgb(var(--text-tertiary))] text-sm">
            Click the link in the email to verify your account and complete setup.
          </p>

          <div className="pt-4 border-t border-[rgba(255,255,255,0.08)]">
            <p className="text-[rgb(var(--text-tertiary))] text-sm">
              Didn't receive the email?{' '}
              <button
                onClick={handleSubmit}
                className="text-[#d4a854] hover:text-[rgb(var(--gold))] font-medium transition-colors"
              >
                Resend verification
              </button>
            </p>
          </div>

          <Link
            to="/auth/login"
            className="block text-[#d4a854] hover:text-[rgb(var(--gold))] text-sm transition-colors"
          >
            Back to login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start managing your restaurant smarter"
    >
      <div className="space-y-6">
        <SocialLogin onGoogleClick={handleGoogleSignIn} isLoading={isLoading} />

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="label-mono block mb-2">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="block w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all"
                placeholder="John"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="label-mono block mb-2">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="block w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="label-mono block mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all"
              placeholder="you@restaurant.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="label-mono block mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all"
              placeholder="At least 8 characters"
            />
            <p className="mt-1 text-xs text-[rgb(var(--text-tertiary))]">
              Must be at least 8 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[rgba(212,168,84,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[#d4a854]" />
                Creating account...
              </div>
            ) : (
              'Create account'
            )}
          </button>

          <p className="text-xs text-[rgb(var(--text-tertiary))] text-center">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-[#d4a854] hover:text-[rgb(var(--gold))] transition-colors">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-[#d4a854] hover:text-[rgb(var(--gold))] transition-colors">Privacy Policy</a>
          </p>
        </form>

        <p className="text-center text-sm text-[rgb(var(--text-secondary))]">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-[#d4a854] hover:text-[rgb(var(--gold))] font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRedirectIfAuthenticated } from '../hooks/useRequireAuth'
import { AuthLayout } from '../components/AuthLayout'
import { SocialLogin } from '../components/SocialLogin'

export function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth()
  const { isReady } = useRedirectIfAuthenticated()

  const [searchParams] = useSearchParams()
  const invited = searchParams.get('invited') === '1'
  const invitedEmail = searchParams.get('email') || ''
  const hasInvitedEmail = invitedEmail.trim().length > 0
  const next = searchParams.get('next')
  const loginHref = next ? `/auth/login?next=${encodeURIComponent(next)}` : '/auth/login'
  const [firstName, setFirstName] = useState('')
  const lastName = ''
  const [accountType, setAccountType] = useState<'owner' | 'reseller'>('owner')
  const [email, setEmail] = useState(invitedEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setError('Enter the email address that received this invitation')
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setIsLoading(false)
      return
    }

    const result = await signUp(normalizedEmail, password, {
      first_name: firstName,
      last_name: lastName,
      account_type: invited ? 'owner' : accountType,
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
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    )
  }

  if (emailSent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent you a verification link"
      >
        <div className="text-center space-y-8 w-full">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <div>
            <p className="text-secondary text-base">
              We've sent a verification email to:
            </p>
            <p className="text-primary font-medium mt-2 text-lg">{email}</p>
          </div>

          <p className="text-tertiary text-sm leading-relaxed">
            Click the link in the email to verify your account and complete setup.
          </p>

          <div className="pt-6 border-t border-dash-border/20">
            <p className="text-tertiary text-sm">
              Didn't receive the email?{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e as any);
                }}
                className="text-primary hover:underline underline-offset-4 font-medium transition-colors"
              >
                Resend verification
              </button>
            </p>
          </div>

          <Link
            to={loginHref}
            className="block text-secondary hover:text-primary text-sm font-medium transition-colors mt-4"
          >
            ← Back to login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Start managing your restaurant smarter"
    >
      <div className="w-full">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {!invited && <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'owner', label: 'Owner', copy: 'One restaurant or company account' },
              { id: 'reseller', label: 'Enterprise', copy: 'Agency, chain, or reseller portfolio' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setAccountType(option.id as 'owner' | 'reseller')}
                className={`rounded-xl border p-3 text-left transition ${
                  accountType === option.id
                    ? 'border-[#36454F] bg-[#36454F]/10 dark:border-white dark:bg-white/10'
                    : 'border-black/10 bg-white/70 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                }`}
              >
                <span className="block text-sm font-semibold text-primary">{option.label}</span>
                <span className="mt-1 block text-xs text-tertiary">{option.copy}</span>
              </button>
            ))}
          </div>}

          <div className="space-y-1.5">
            <label htmlFor="firstName" className="block text-sm font-semibold text-primary">
              Name
            </label>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-primary placeholder:text-tertiary/50 focus:outline-none focus:ring-2 focus:ring-[#36454F]/20 dark:focus:ring-white/20 transition-all text-[15px]"
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-semibold text-primary">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              readOnly={invited && hasInvitedEmail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-primary placeholder:text-tertiary/50 focus:outline-none focus:ring-2 focus:ring-[#36454F]/20 dark:focus:ring-white/20 transition-all text-[15px]"
              placeholder="Your email"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-semibold text-primary">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-primary placeholder:text-tertiary/50 focus:outline-none focus:ring-2 focus:ring-[#36454F]/20 dark:focus:ring-white/20 transition-all text-[15px]"
                placeholder="Create a password"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-tertiary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold bg-[#36454F] dark:bg-white text-white dark:text-black hover:bg-[#2a363e] dark:hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#36454F]/50 focus:ring-offset-base disabled:opacity-50 transition-all mt-6"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-px border-base" />
                Creating account...
              </div>
            ) : (
              'Sign up'
            )}
          </button>

          <p className="text-xs text-tertiary text-center mt-5">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-secondary hover:text-primary underline underline-offset-2 transition-colors">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-secondary hover:text-primary underline underline-offset-2 transition-colors">Privacy Policy</a>
          </p>
        </form>

        <div className="mt-8">
          <SocialLogin onGoogleClick={handleGoogleSignIn} isLoading={isLoading} />
        </div>

        <p className="mt-8 text-center text-sm font-medium text-tertiary">
          Already have an account?{' '}
          <Link to={loginHref} className="text-secondary hover:text-primary transition-all">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

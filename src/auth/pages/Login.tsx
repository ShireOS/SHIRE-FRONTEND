import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRedirectIfAuthenticated } from '../hooks/useRequireAuth'
import { AuthLayout } from '../components/AuthLayout'
import { SocialLogin } from '../components/SocialLogin'

export function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth()
  const { isReady } = useRedirectIfAuthenticated()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const result = await signIn(email, password)

    if (!result.success) {
      setError(result.error || 'Failed to sign in')
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

  return (
    <AuthLayout
      title="Access Your Account"
      subtitle="The standard for restaurant intelligence and operations"
    >
      <div className="w-full">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-semibold text-primary">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-transparent border border-dash-border/60 hover:border-dash-border/80 text-primary placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-[15px] shadow-sm"
              placeholder="Your email"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-semibold text-primary">
                Password
              </label>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-transparent border border-dash-border/60 hover:border-dash-border/80 text-primary placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-[15px] shadow-sm"
              placeholder="Create a password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold bg-[#1C1C1E] dark:bg-white text-white dark:text-black hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-base disabled:opacity-50 transition-all mt-6 shadow-sm"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-px border-base" />
                Signing in...
              </div>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="mt-8">
          <SocialLogin onGoogleClick={handleGoogleSignIn} isLoading={isLoading} />
        </div>

        <p className="mt-8 text-center text-sm font-medium text-tertiary">
          Don't have an account?{' '}
          <Link to="/auth/signup" className="text-secondary hover:text-primary transition-all">
            Sign up
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

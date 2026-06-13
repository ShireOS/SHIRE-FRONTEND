import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRedirectIfAuthenticated } from '../hooks/useRequireAuth'
import { AuthLayout } from '../components/AuthLayout'
import { SocialLogin } from '../components/SocialLogin'
import { API_CONFIG } from '../../shared/api/config'

interface EmployeeRestaurant {
  id: string
  name: string
  city?: string | null
  state?: string | null
}

export function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth()
  const { isReady } = useRedirectIfAuthenticated()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'manager' | 'employee'>('manager')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [restaurants, setRestaurants] = useState<EmployeeRestaurant[]>([])
  const [restaurantSearch, setRestaurantSearch] = useState('')
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [employeeIdentifier, setEmployeeIdentifier] = useState('')
  const [employeePin, setEmployeePin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const filteredRestaurants = useMemo(() => {
    const query = restaurantSearch.trim().toLowerCase()
    if (!query) return restaurants
    return restaurants.filter(restaurant =>
      [restaurant.name, restaurant.city, restaurant.state]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [restaurantSearch, restaurants])

  useEffect(() => {
    if (mode !== 'employee' || restaurants.length > 0) return

    let cancelled = false
    const loadRestaurants = async () => {
      const primary = await fetch(`${API_CONFIG.baseUrl}/employee-auth/restaurants`)
      if (primary.ok) return primary.json()

      const fallback = await fetch(`${API_CONFIG.baseUrl}/restaurants`)
      if (fallback.ok) return fallback.json()

      throw new Error(`Could not load restaurants (${primary.status})`)
    }

    loadRestaurants()
      .then((data: EmployeeRestaurant[]) => {
        if (cancelled) return
        setRestaurants(data)
        if (data[0]) setSelectedRestaurantId(data[0].id)
      })
      .catch(err => {
        if (!cancelled) {
          const message = err instanceof TypeError
            ? `Could not reach the backend at ${API_CONFIG.baseUrl}. Start/restart the backend and try again.`
            : err instanceof Error ? err.message : 'Could not load restaurants'
          setError(message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [mode, restaurants.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (mode === 'employee') {
      if (!selectedRestaurantId) {
        setError('Select a restaurant first')
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`${API_CONFIG.baseUrl}/employee-auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurant_id: selectedRestaurantId,
            identifier: employeeIdentifier.trim(),
            pin: employeePin,
          }),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.detail || 'Invalid employee login')
        }

        const payload = await response.json()
        localStorage.setItem('shire_employee_token', payload.access_token)
        localStorage.setItem('shire_employee_profile', JSON.stringify(payload))
        navigate('/employee', { replace: true })
        return
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sign in')
        setIsLoading(false)
        return
      }
    }

    const result = await signIn(email, password)

    if (!result.success) {
      setError(result.error || 'Failed to sign in')
      setIsLoading(false)
      return
    }

    navigate('/', { replace: true })
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
        <div className="mb-6 grid grid-cols-2 rounded-xl border border-dash-border/60 p-1">
          {(['manager', 'employee'] as const).map(item => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setMode(item)
                setError(null)
              }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                mode === item
                  ? 'bg-[#1C1C1E] text-white dark:bg-white dark:text-black'
                  : 'text-tertiary hover:text-primary'
              }`}
            >
              {item === 'manager' ? 'Manager' : 'Employee'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {mode === 'employee' ? (
            <>
              <div className="space-y-1.5">
                <label htmlFor="restaurant-search" className="block text-sm font-semibold text-primary">
                  Restaurant
                </label>
                <input
                  id="restaurant-search"
                  type="text"
                  value={restaurantSearch}
                  onChange={(e) => setRestaurantSearch(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-transparent border border-dash-border/60 hover:border-dash-border/80 text-primary placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-[15px] shadow-sm"
                  placeholder="Search restaurants"
                />
                <select
                  value={selectedRestaurantId}
                  onChange={(e) => setSelectedRestaurantId(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-transparent border border-dash-border/60 hover:border-dash-border/80 text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-[15px] shadow-sm"
                >
                  {filteredRestaurants.map(restaurant => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}{restaurant.city ? ` · ${restaurant.city}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="employeeIdentifier" className="block text-sm font-semibold text-primary">
                  Email or Employee ID
                </label>
                <input
                  id="employeeIdentifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={employeeIdentifier}
                  onChange={(e) => setEmployeeIdentifier(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-transparent border border-dash-border/60 hover:border-dash-border/80 text-primary placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-[15px] shadow-sm"
                  placeholder="ryan or you@restaurant.com"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="employeePin" className="block text-sm font-semibold text-primary">
                  PIN
                </label>
                <input
                  id="employeePin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  required
                  value={employeePin}
                  onChange={(e) => setEmployeePin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="w-full px-4 py-3 rounded-xl bg-transparent border border-dash-border/60 hover:border-dash-border/80 text-primary placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-[15px] shadow-sm"
                  placeholder="PIN"
                />
              </div>
            </>
          ) : (
            <>
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
                  placeholder="Your password"
                />
              </div>
            </>
          )}

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

        {mode === 'manager' && (
          <>
            <div className="mt-8">
              <SocialLogin onGoogleClick={handleGoogleSignIn} isLoading={isLoading} />
            </div>

            <p className="mt-8 text-center text-sm font-medium text-tertiary">
              Don't have an account?{' '}
              <Link to="/auth/signup" className="text-secondary hover:text-primary transition-all">
                Sign up
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
